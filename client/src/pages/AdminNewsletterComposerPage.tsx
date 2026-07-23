import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Plus, Send, Trash2, Clock, CheckCircle, AlertCircle,
  Users, Loader2, Newspaper, Calendar, ChevronUp, ChevronDown,
  GripVertical, Radio, BookOpen, MessageSquare, Search, X, Link2,
  ArrowLeft, Pencil, UserPlus, Eye, FileText, Upload,
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import { AdminSidebar } from "@/components/layout/AdminSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { utcToLocalDatetimeLocal } from "@/lib/dateUtils";
// TipTap
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";

const lowlight = createLowlight(common);

// ---- Types ----
interface NewsletterDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  status: string;
  recipient_role: string;
  recipient_batch: string;
  recipient_graduation_year: string;
  recipient_department: string;
  custom_recipient_emails: string | null;
  scheduled_at: string | null;
}

interface RecipientPreview {
  count: number;
  serverCount: number;
  users: Array<{ id: string; email: string; name: string }>;
}

interface Article {
  id: string;
  title: string;
  image: string;
  content: string;
}

type EmbedType = "blog" | "podcast" | "post" | "pdf";

interface EmbeddedItem {
  embedId: string;
  type: EmbedType;
  id: string;
  title: string;
  excerpt: string;
  coverImage: string;
  url: string;
  meta: string;
}

interface CustomEmail {
  uid: string;
  email: string;
  name: string;
  isExternal: boolean;
  role?: string;
  batch?: string;
}

type SearchUser = { id: string; email: string; name: string; role?: string; batch?: string };

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function normalizePdfUrl(raw: string): string {
  return raw.replace(
    /^(https:\/\/drive\.google\.com\/file\/d\/[^/?#]+)\/(view|edit)[^#]*/i,
    "$1/preview"
  );
}

function driveFileId(url: string): string | null {
  const m = url.match(/drive\.google\.com\/file\/d\/([^/?#]+)/i);
  return m ? m[1] : null;
}

function driveThumbnailUrl(url: string): string | null {
  const id = driveFileId(url);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w400` : null;
}

function articlesToHtml(articles: Article[]): string {
  return articles
    .map(
      (a) =>
        `<section data-article="${a.id}">` +
        (a.title ? `<h2 data-article-title>${a.title}</h2>` : "") +
        (a.image ? `<img data-article-image src="${a.image}" alt="" />` : "") +
        `<div data-article-body>${a.content}</div>` +
        `</section>`
    )
    .join("\n");
}

function embeddedItemsToHtml(items: EmbeddedItem[]): string {
  if (!items.length) return "";
  return items
    .map(
      (item) =>
        `<div data-embedded="${item.embedId}" data-embedded-type="${item.type}" data-embedded-id="${item.id}" data-embedded-url="${item.url}" data-embedded-cover="${item.coverImage}" data-embedded-meta="${item.meta}">` +
        (item.title ? `<span data-embedded-title>${item.title}</span>` : "") +
        (item.excerpt ? `<span data-embedded-excerpt>${item.excerpt}</span>` : "") +
        `</div>`
    )
    .join("\n");
}

function parseEmbeddedFromHtml(html: string): EmbeddedItem[] {
  if (!html || !html.includes("data-embedded=")) return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  return Array.from(doc.querySelectorAll("[data-embedded]")).map((el) => ({
    embedId: el.getAttribute("data-embedded") || makeId(),
    type: (el.getAttribute("data-embedded-type") || "blog") as EmbedType,
    id: el.getAttribute("data-embedded-id") || "",
    title: (el.querySelector("[data-embedded-title]") as HTMLElement)?.textContent || "",
    excerpt: (el.querySelector("[data-embedded-excerpt]") as HTMLElement)?.textContent || "",
    coverImage: el.getAttribute("data-embedded-cover") || "",
    url: el.getAttribute("data-embedded-url") || "",
    meta: el.getAttribute("data-embedded-meta") || "",
  }));
}

function parseArticlesFromHtml(html: string): Article[] | null {
  if (!html || !html.includes("data-article=")) return null;
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const sections = Array.from(doc.querySelectorAll("section[data-article]"));
  if (!sections.length) return null;
  return sections.map((sec) => ({
    id: sec.getAttribute("data-article") || makeId(),
    title: (sec.querySelector("[data-article-title]") as HTMLElement)?.textContent || "",
    image: (sec.querySelector("[data-article-image]") as HTMLImageElement)?.getAttribute("src") || "",
    content: (sec.querySelector("[data-article-body]") as HTMLElement)?.innerHTML || "",
  }));
}

const EMBED_TYPE_CONFIG: Record<EmbedType, { label: string; icon: React.ElementType; color: string; bgColor: string }> = {
  blog:    { label: "Blog",    icon: BookOpen,      color: "text-violet-600", bgColor: "bg-violet-50" },
  podcast: { label: "Podcast", icon: Radio,         color: "text-rose-600",   bgColor: "bg-rose-50"   },
  post:    { label: "Post",    icon: MessageSquare, color: "text-sky-600",    bgColor: "bg-sky-50"    },
  pdf:     { label: "PDF",     icon: FileText,      color: "text-amber-600",  bgColor: "bg-amber-50"  },
};

const AUTOSAVE_KEY_PREFIX = "newsletter_draft_";

// ---- Inline TipTap toolbar ----
function ToolbarBtn({ onClick, active, title, children }: { onClick: () => void; active?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors ${active ? "bg-[#008060] text-white" : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"}`}
    >
      {children}
    </button>
  );
}

function NlEditorToolbar({ editor }: { editor: any }) {
  if (!editor) return null;
  const addLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) editor.chain().focus().extendMarkRange("link").setLink({ href: url, target: "_blank" }).run();
  };
  const addImage = () => {
    const url = window.prompt("Enter image URL:");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };
  return (
    <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-gray-200 bg-gray-50 rounded-t-md">
      <ToolbarBtn title="H1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })}>H1</ToolbarBtn>
      <ToolbarBtn title="H2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}>H2</ToolbarBtn>
      <ToolbarBtn title="H3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}>H3</ToolbarBtn>
      <span className="w-px h-5 bg-gray-300 mx-1" />
      <ToolbarBtn title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}><strong>B</strong></ToolbarBtn>
      <ToolbarBtn title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><em>I</em></ToolbarBtn>
      <ToolbarBtn title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}><s>S</s></ToolbarBtn>
      <ToolbarBtn title="Code" onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")}><code className="font-mono text-xs">`c`</code></ToolbarBtn>
      <span className="w-px h-5 bg-gray-300 mx-1" />
      <ToolbarBtn title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>• List</ToolbarBtn>
      <ToolbarBtn title="Ordered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>1. List</ToolbarBtn>
      <ToolbarBtn title="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}>" Quote</ToolbarBtn>
      <ToolbarBtn title="Code block" onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")}>{"</>"}</ToolbarBtn>
      <span className="w-px h-5 bg-gray-300 mx-1" />
      <ToolbarBtn title="Link" onClick={addLink} active={editor.isActive("link")}>🔗</ToolbarBtn>
      <ToolbarBtn title="Image" onClick={addImage}>🖼</ToolbarBtn>
    </div>
  );
}

// ---- Single article editor card ----
function ArticleEditorCard({
  article, index, total, onChange, onRemove, onMoveUp, onMoveDown,
}: {
  article: Article; index: number; total: number;
  onChange: (updated: Article) => void;
  onRemove: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: article.content || "",
    onUpdate: ({ editor }) => onChange({ ...article, content: editor.getHTML() }),
  });

  // Set content once on mount (safe because key=article.id ensures remount on reorder)
  useEffect(() => {
    if (editor) editor.commands.setContent(article.content || "", { emitUpdate: false });
  }, [editor]);

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-100 bg-gray-50 rounded-t-xl">
        <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex-1">Article {index + 1}</span>
        <button type="button" disabled={index === 0} onClick={onMoveUp} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed" title="Move up">
          <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
        </button>
        <button type="button" disabled={index === total - 1} onClick={onMoveDown} className="p-1 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed" title="Move down">
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        </button>
        {total > 1 && (
          <button type="button" onClick={onRemove} className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 ml-1" title="Remove article">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <div className="p-4 space-y-3">
        <div>
          <Label className="text-xs">Article Title <span className="text-gray-400 font-normal">(optional)</span></Label>
          <input
            type="text" value={article.title}
            onChange={(e) => onChange({ ...article, title: e.target.value })}
            placeholder="e.g. Alumni Spotlight" maxLength={200}
            className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]/30 focus:border-[#008060]"
          />
        </div>
        <div>
          <Label className="text-xs">Image URL <span className="text-gray-400 font-normal">(optional)</span></Label>
          <input
            type="text" value={article.image}
            onChange={(e) => onChange({ ...article, image: e.target.value })}
            placeholder="https://…"
            className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]/30 focus:border-[#008060]"
          />
          {article.image && (
            <img src={article.image} alt="Article" className="mt-2 rounded-md h-20 object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
          )}
        </div>
        <div>
          <Label className="text-xs">Body *</Label>
          <div className="mt-1 border border-gray-200 rounded-md overflow-hidden cursor-text" onClick={() => editor?.chain().focus().run()}>
            <NlEditorToolbar editor={editor} />
            <EditorContent editor={editor} className="prose prose-sm max-w-none min-h-[140px] p-3 focus-within:outline-none [&_.ProseMirror]:min-h-[120px] [&_.ProseMirror]:outline-none" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Content picker panel ----
function ContentPickerPanel({
  getHeaders, attachedItems, onAttach, onDetach,
}: {
  getHeaders: () => Record<string, string>;
  attachedItems: EmbeddedItem[];
  onAttach: (item: EmbeddedItem) => void;
  onDetach: (embedId: string) => void;
}) {
  const [activeType, setActiveType] = useState<EmbedType>("blog");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attachedIds = new Set(attachedItems.map((i) => i.id));

  const search = useCallback(async (type: EmbedType, q: string) => {
    setSearching(true); setResults([]);
    try {
      let url = "";
      if (type === "blog")    url = `/api/blogs?limit=10&search=${encodeURIComponent(q)}`;
      if (type === "podcast") url = `/api/podcasts?limit=10&search=${encodeURIComponent(q)}`;
      if (type === "post")    url = `/api/posts?limit=10&search=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      setResults(data.blogs ?? data.episodes ?? data.podcasts ?? data.posts ?? data.feedPosts ?? []);
    } catch { setResults([]); } finally { setSearching(false); }
  }, [getHeaders]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => search(activeType, query), 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query, activeType, search]);

  const handleTabChange = (type: EmbedType) => {
    setActiveType(type); setQuery(""); setResults([]);
  };

  const buildItem = (type: EmbedType, raw: any): EmbeddedItem => {
    if (type === "blog") return {
      embedId: makeId(), type, id: raw.id, title: raw.title || "", excerpt: raw.excerpt || "",
      coverImage: raw.cover_image || "", url: `/blogs/${raw.slug}`,
      meta: raw.author ? `${raw.author.first_name || ""} ${raw.author.last_name || ""}`.trim() : "",
    };
    if (type === "podcast") return {
      embedId: makeId(), type, id: raw.id, title: raw.title || "", excerpt: raw.description || "",
      coverImage: "", url: `/podcasts`, meta: raw.episode_number ? `Episode ${raw.episode_number}` : "",
    };
    return {
      embedId: makeId(), type, id: raw.id, title: "", excerpt: raw.content ? raw.content.slice(0, 140) : "",
      coverImage: raw.image_url || "", url: `/feed`,
      meta: raw.author_first_name ? `${raw.author_first_name} ${raw.author_last_name || ""}`.trim() : "",
    };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1 p-1 bg-gray-100 rounded-lg w-fit">
        {(["blog", "podcast", "post"] as EmbedType[]).map((t) => {
          const cfg = EMBED_TYPE_CONFIG[t]; const Icon = cfg.icon;
          return (
            <button key={t} type="button" onClick={() => handleTabChange(t)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeType === t ? `bg-white shadow-sm ${cfg.color}` : "text-gray-500 hover:text-gray-700"}`}>
              <Icon className="w-3.5 h-3.5" />{cfg.label}s
            </button>
          );
        })}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${EMBED_TYPE_CONFIG[activeType].label.toLowerCase()}s…`}
          className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]/30 focus:border-[#008060]" />
        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />}
      </div>
      {results.length > 0 && (
        <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100 max-h-64 overflow-y-auto">
          {results.map((raw) => {
            const item = buildItem(activeType, raw);
            const alreadyAttached = attachedIds.has(item.id);
            const cfg = EMBED_TYPE_CONFIG[activeType]; const Icon = cfg.icon;
            return (
              <div key={raw.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 transition-colors">
                {item.coverImage ? (
                  <img src={item.coverImage} alt="" className="w-12 h-12 rounded-md object-cover flex-shrink-0" onError={(e) => (e.currentTarget.style.display = "none")} />
                ) : (
                  <div className={`w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0 ${cfg.bgColor}`}><Icon className={`w-5 h-5 ${cfg.color}`} /></div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate leading-snug">{item.title || item.excerpt.slice(0, 60) || "Untitled"}</p>
                  {item.meta && <p className="text-xs text-gray-400 mt-0.5">{item.meta}</p>}
                  {item.excerpt && item.title && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{item.excerpt}</p>}
                </div>
                <button type="button"
                  onClick={() => alreadyAttached ? onDetach(attachedItems.find((i) => i.id === item.id)!.embedId) : onAttach(item)}
                  className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${alreadyAttached ? "bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-600" : "bg-[#008060] text-white hover:bg-[#006b51]"}`}>
                  {alreadyAttached ? "Remove" : "Attach"}
                </button>
              </div>
            );
          })}
        </div>
      )}
      {!searching && query && results.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">No {EMBED_TYPE_CONFIG[activeType].label.toLowerCase()}s found for "{query}"</p>
      )}
      {!query && results.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-4">Search to find {EMBED_TYPE_CONFIG[activeType].label.toLowerCase()}s to attach</p>
      )}
      {attachedItems.filter((i) => i.type !== "pdf").length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Attached ({attachedItems.filter((i) => i.type !== "pdf").length})</p>
          <div className="space-y-1.5">
            {attachedItems.filter((i) => i.type !== "pdf").map((item) => {
              const cfg = EMBED_TYPE_CONFIG[item.type]; const Icon = cfg.icon;
              return (
                <div key={item.embedId} className="flex items-center gap-2.5 p-2.5 border border-gray-200 rounded-lg bg-white">
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 ${cfg.bgColor}`}><Icon className={`w-3.5 h-3.5 ${cfg.color}`} /></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{item.title || item.excerpt.slice(0, 50) || (item.type === "pdf" ? item.url : "Untitled")}</p>
                    <p className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</p>
                  </div>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 p-1" title="Preview"><Link2 className="w-3 h-3" /></a>
                  <button type="button" onClick={() => onDetach(item.embedId)} className="text-gray-400 hover:text-red-500 p-1" title="Remove"><X className="w-3.5 h-3.5" /></button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Custom email recipients panel ----
function RecipientInitials({ name, email, variant }: { name: string; email: string; variant: "internal" | "external" }) {
  const letter = (name || email)[0]?.toUpperCase() ?? "?";
  return (
    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${variant === "internal" ? "bg-[#008060]/10 text-[#008060]" : "bg-amber-100 text-amber-700"}`}>
      {letter}
    </div>
  );
}

function CustomEmailsPanel({
  getHeaders,
  customEmails,
  onChange,
}: {
  getHeaders: () => Record<string, string>;
  customEmails: CustomEmail[];
  onChange: (emails: CustomEmail[]) => void;
}) {
  const { toast } = useToast();
  const [addMode, setAddMode] = useState<"search" | "external">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [freeEmail, setFreeEmail] = useState("");
  const [freeName, setFreeName] = useState("");
  const [bulkPasteMode, setBulkPasteMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [editState, setEditState] = useState<{ uid: string; email: string; name: string } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const addedEmails = new Set(customEmails.map((e) => e.email.toLowerCase()));

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQuery.trim() || searchQuery.trim().length < 2) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/admin/newsletters/user-search?q=${encodeURIComponent(searchQuery.trim())}`, { headers: getHeaders() });
        const data = await res.json();
        setSearchResults(data.users ?? []);
      } catch { setSearchResults([]); } finally { setSearching(false); }
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery, getHeaders]);

  const addUser = (u: SearchUser) => {
    if (addedEmails.has(u.email.toLowerCase())) return;
    onChange([...customEmails, { uid: makeId(), email: u.email, name: u.name, isExternal: false, role: u.role, batch: u.batch }]);
    setSearchQuery("");
    setSearchResults([]);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const addFreeEmail = () => {
    const trimmedEmail = freeEmail.trim();
    if (!trimmedEmail) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast({ title: "Invalid email", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }
    if (addedEmails.has(trimmedEmail.toLowerCase())) {
      toast({ title: "Already added", description: "This email is already in the list", variant: "destructive" });
      return;
    }
    onChange([...customEmails, { uid: makeId(), email: trimmedEmail, name: freeName.trim(), isExternal: true }]);
    setFreeEmail("");
    setFreeName("");
  };

  const applyBulkPaste = () => {
    const tokens = bulkText
      .split(/[\n,;\s]+/)
      .map((t) => t.trim())
      .filter((t) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t));
    const totalTokens = bulkText.split(/[\n,;\s]+/).filter((t) => t.trim()).length;
    const invalid = totalTokens - tokens.length;
    const newOnes = tokens.filter((e) => !addedEmails.has(e.toLowerCase()));
    const dupes = tokens.length - newOnes.length;
    const added: CustomEmail[] = newOnes.map((e) => ({ uid: makeId(), email: e, name: "", isExternal: true }));
    if (added.length) onChange([...customEmails, ...added]);
    setBulkText("");
    setBulkPasteMode(false);
    const parts = [dupes > 0 && `${dupes} duplicate(s) skipped`, invalid > 0 && `${invalid} invalid skipped`].filter(Boolean).join(", ");
    toast({ title: `${added.length} email${added.length !== 1 ? "s" : ""} added`, description: parts || undefined });
  };

  const removeEmail = (uid: string) => onChange(customEmails.filter((e) => e.uid !== uid));

  const saveEdit = () => {
    if (!editState) return;
    const trimmedEmail = editState.email.trim();
    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast({ title: "Invalid email", variant: "destructive" }); return;
    }
    if (customEmails.some((e) => e.uid !== editState.uid && e.email.toLowerCase() === trimmedEmail.toLowerCase())) {
      toast({ title: "Duplicate email", variant: "destructive" }); return;
    }
    onChange(customEmails.map((e) => e.uid === editState.uid ? { ...e, email: trimmedEmail, name: editState.name.trim() } : e));
    setEditState(null);
  };

  const internal = customEmails.filter((e) => !e.isExternal);
  const external = customEmails.filter((e) => e.isExternal);

  return (
    <div className="space-y-4">
      {/* Mode toggle */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
        {(["search", "external"] as const).map((mode) => (
          <button
            key={mode} type="button"
            onClick={() => { setAddMode(mode); setSearchQuery(""); setSearchResults([]); setFreeEmail(""); setFreeName(""); setBulkPasteMode(false); }}
            className={`flex-1 text-xs font-medium py-1.5 px-3 rounded-md transition-colors ${addMode === mode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {mode === "search" ? "Search users" : "External email"}
          </button>
        ))}
      </div>

      {/* Search tab */}
      {addMode === "search" && (
        <div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              ref={searchInputRef}
              type="text" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full pl-9 pr-8 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]/30 focus:border-[#008060]"
            />
            {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 animate-spin" />}
          </div>
          {searchResults.length > 0 && (
            <div className="mt-1 border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100 max-h-52 overflow-y-auto shadow-sm">
              {searchResults.map((u) => {
                const already = addedEmails.has(u.email.toLowerCase());
                return (
                  <div key={u.id} className={`flex items-center gap-3 px-3 py-2.5 ${already ? "bg-gray-50" : "hover:bg-gray-50"}`}>
                    <RecipientInitials name={u.name} email={u.email} variant="internal" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{u.name || u.email}</p>
                      {u.name && <p className="text-xs text-gray-500 truncate">{u.email}</p>}
                      {(u.role || u.batch) && (
                        <div className="flex gap-1 mt-0.5 flex-wrap">
                          {u.role && <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full font-medium">{u.role}</span>}
                          {u.batch && <span className="text-[10px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded-full font-medium">{u.batch}</span>}
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={() => addUser(u)} disabled={already}
                      className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${already ? "bg-gray-100 text-gray-400 cursor-default" : "bg-[#008060] text-white hover:bg-[#006b51]"}`}>
                      {already ? "Added" : "Add"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-2 py-1">No users found for "{searchQuery}"</p>
          )}
        </div>
      )}

      {/* External email tab */}
      {addMode === "external" && (
        <div className="space-y-3">
          {!bulkPasteMode ? (
            <>
              <div className="space-y-2">
                <input
                  type="email" value={freeEmail}
                  onChange={(e) => setFreeEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFreeEmail(); } }}
                  placeholder="Email address *"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]/30 focus:border-[#008060]"
                />
                <div className="flex gap-2">
                  <input
                    type="text" value={freeName}
                    onChange={(e) => setFreeName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFreeEmail(); } }}
                    placeholder="Display name (optional)"
                    className="flex-1 border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]/30 focus:border-[#008060]"
                  />
                  <button type="button" onClick={addFreeEmail}
                    className="flex items-center gap-1.5 px-3 py-2 bg-[#008060] text-white text-sm rounded-md hover:bg-[#006b51] transition-colors font-medium flex-shrink-0">
                    <UserPlus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>
              <button type="button" onClick={() => setBulkPasteMode(true)}
                className="text-xs text-[#008060] hover:underline font-medium">
                + Paste multiple emails
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">Paste emails separated by commas, semicolons, or new lines.</p>
              <textarea
                value={bulkText} onChange={(e) => setBulkText(e.target.value)}
                placeholder={"a@example.com\nb@example.com, c@example.com"}
                rows={4} autoFocus
                className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]/30 focus:border-[#008060] resize-none"
              />
              <div className="flex gap-2">
                <button type="button" onClick={applyBulkPaste} disabled={!bulkText.trim()}
                  className="px-3 py-1.5 bg-[#008060] text-white text-xs rounded-md hover:bg-[#006b51] font-medium disabled:opacity-40">
                  Add all
                </button>
                <button type="button" onClick={() => { setBulkPasteMode(false); setBulkText(""); }}
                  className="px-3 py-1.5 border border-gray-200 text-gray-500 text-xs rounded-md hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Custom recipient list */}
      {customEmails.length > 0 && (
        <div className="space-y-3 border-t border-gray-100 pt-3">
          {internal.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">Internal — {internal.length}</p>
              <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                {internal.map((item) => (
                  <div key={item.uid} className="px-3 py-2.5">
                    {editState?.uid === item.uid ? (
                      <div className="space-y-1.5">
                        <input type="text" value={editState.name} onChange={(e) => setEditState({ ...editState, name: e.target.value })}
                          placeholder="Display name" className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#008060]" />
                        <input type="email" value={editState.email} onChange={(e) => setEditState({ ...editState, email: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditState(null); }}
                          placeholder="Email address" className="w-full border border-[#008060] rounded px-2 py-1 text-sm focus:outline-none" autoFocus />
                        <div className="flex gap-1.5">
                          <button type="button" onClick={saveEdit} className="text-xs px-2.5 py-1 bg-[#008060] text-white rounded-md hover:bg-[#006b51]">Save</button>
                          <button type="button" onClick={() => setEditState(null)} className="text-xs px-2.5 py-1 border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <RecipientInitials name={item.name} email={item.email} variant="internal" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{item.name || item.email}</p>
                          {item.name && <p className="text-xs text-gray-500 truncate">{item.email}</p>}
                          {(item.role || item.batch) && (
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {item.role && <span className="text-[10px] bg-violet-50 text-violet-600 px-1.5 py-0.5 rounded-full font-medium">{item.role}</span>}
                              {item.batch && <span className="text-[10px] bg-sky-50 text-sky-600 px-1.5 py-0.5 rounded-full font-medium">{item.batch}</span>}
                            </div>
                          )}
                        </div>
                        <button type="button" onClick={() => setEditState({ uid: item.uid, email: item.email, name: item.name })}
                          className="p-1.5 text-gray-400 hover:text-[#008060] hover:bg-green-50 rounded-md transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => removeEmail(item.uid)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Remove">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {external.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">External — {external.length}</p>
              <div className="border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                {external.map((item) => (
                  <div key={item.uid} className="px-3 py-2.5">
                    {editState?.uid === item.uid ? (
                      <div className="space-y-1.5">
                        <input type="text" value={editState.name} onChange={(e) => setEditState({ ...editState, name: e.target.value })}
                          placeholder="Display name" className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#008060]" />
                        <input type="email" value={editState.email} onChange={(e) => setEditState({ ...editState, email: e.target.value })}
                          onKeyDown={(e) => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditState(null); }}
                          placeholder="Email address" className="w-full border border-[#008060] rounded px-2 py-1 text-sm focus:outline-none" autoFocus />
                        <div className="flex gap-1.5">
                          <button type="button" onClick={saveEdit} className="text-xs px-2.5 py-1 bg-[#008060] text-white rounded-md hover:bg-[#006b51]">Save</button>
                          <button type="button" onClick={() => setEditState(null)} className="text-xs px-2.5 py-1 border border-gray-200 rounded-md text-gray-500 hover:bg-gray-50">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <RecipientInitials name={item.name} email={item.email} variant="external" />
                        <div className="flex-1 min-w-0">
                          {item.name
                            ? <><p className="text-sm font-medium text-gray-900 truncate">{item.name}</p><p className="text-xs text-gray-500 truncate">{item.email}</p></>
                            : <p className="text-sm font-medium text-gray-900 truncate">{item.email}</p>
                          }
                        </div>
                        <button type="button" onClick={() => setEditState({ uid: item.uid, email: item.email, name: item.name })}
                          className="p-1.5 text-gray-400 hover:text-[#008060] hover:bg-green-50 rounded-md transition-colors" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => removeEmail(item.uid)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Remove">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {customEmails.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-2">No custom recipients added yet</p>
      )}
    </div>
  );
}

// ---- Shared newsletter preview body (used in sticky panel + slide-over) ----
function NewsletterPreviewBody({
  title, excerpt, articles, embeddedItems,
  recipientPreview, previewLoading,
  recipientRole, recipientBatch, recipientGradYear, recipientDepartment, customEmails,
}: {
  title: string; excerpt: string;
  articles: Article[]; embeddedItems: EmbeddedItem[];
  recipientPreview: RecipientPreview | null; previewLoading: boolean;
  recipientRole: string; recipientBatch: string; recipientGradYear: string;
  recipientDepartment: string; customEmails: CustomEmail[];
}) {
  return (
    <div className="p-5 space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 leading-tight">
          {title || <span className="text-gray-300 italic font-normal">Newsletter title…</span>}
        </h2>
        {excerpt && <p className="text-sm text-gray-500 italic mt-1">{excerpt}</p>}
      </div>
      {articles.map((a, i) => (
        <div key={a.id} className={i > 0 ? "border-t border-gray-100 pt-4" : ""}>
          {a.title && <h3 className="text-sm font-semibold text-gray-800 mb-2">{a.title}</h3>}
          {a.image && (
            <img src={a.image} alt="" className="rounded-md mb-2 w-full max-h-28 object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
          )}
          {a.content ? (
            <div className="prose prose-sm max-w-none text-gray-700 [&_*]:text-sm" dangerouslySetInnerHTML={{ __html: a.content }} />
          ) : (
            <p className="text-xs text-gray-300 italic">Article body…</p>
          )}
        </div>
      ))}
      {embeddedItems.length > 0 && (
        <div className="border-t border-gray-100 pt-4 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Attached Content</p>
          {embeddedItems.map((item) => {
            const cfg = EMBED_TYPE_CONFIG[item.type]; const Icon = cfg.icon;
            return (
              <div key={item.embedId} className={`flex items-start gap-3 p-3 rounded-lg border border-gray-100 ${cfg.bgColor}`}>
                <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 bg-white border border-gray-200">
                  <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${cfg.color}`}>{cfg.label}</p>
                  <p className="text-xs font-medium text-gray-900 leading-snug truncate">{item.title || item.excerpt.slice(0, 60) || (item.type === "pdf" ? item.url : "Untitled")}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Recipients summary */}
      <div className="border-t border-gray-100 pt-4 space-y-1.5">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Recipients</p>
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          {previewLoading ? (
            <Loader2 className="w-3 h-3 animate-spin text-gray-400" />
          ) : (
            <Users className="w-3 h-3 text-gray-400 flex-shrink-0" />
          )}
          {recipientPreview ? (
            <span><span className="font-semibold text-gray-800">{recipientPreview.count}</span> matched</span>
          ) : (
            <span className="text-gray-400">—</span>
          )}
        </div>
        <p className="text-xs text-gray-500">
          {[
            recipientRole !== "all" ? recipientRole : null,
            recipientBatch !== "all" ? recipientBatch : null,
            recipientGradYear !== "all" ? `Class of ${recipientGradYear}` : null,
            recipientDepartment !== "all" ? recipientDepartment : null,
          ].filter(Boolean).join(" · ") || "All alumni"}
          {customEmails.length > 0 && ` + ${customEmails.length} custom`}
        </p>
      </div>
    </div>
  );
}

// ---- Main page ----
export function AdminNewsletterComposerPage() {
  const { user, adminUser } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Detect if we're editing (/admin/newsletters/:id/edit) or creating (/admin/newsletters/new)
  const [matchEdit, paramsEdit] = useRoute("/admin/newsletters/:id/edit");
  const newsletterId = matchEdit ? paramsEdit?.id ?? null : null;
  const isEdit = !!newsletterId;

  React.useEffect(() => {
    document.title = isEdit ? "Edit Newsletter - Admin" : "New Newsletter - Admin";
  }, [isEdit]);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("auth_token") || "";
    const userId = adminUser?.id || user?.id || localStorage.getItem("userId") || "";
    return {
      "Content-Type": "application/json",
      "user-id": userId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }, [adminUser?.id, user?.id]);

  // ---- State ----
  const [loadingNewsletter, setLoadingNewsletter] = useState(isEdit);
  const [newsletter, setNewsletter] = useState<NewsletterDetail | null>(null);

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [recipientRole, setRecipientRole] = useState("all");
  const [recipientBatch, setRecipientBatch] = useState("all");
  const [recipientGradYear, setRecipientGradYear] = useState("all");
  const [recipientDepartment, setRecipientDepartment] = useState("all");
  const [customEmails, setCustomEmails] = useState<CustomEmail[]>([]);
  const [deliveryMode, setDeliveryMode] = useState<"draft" | "schedule" | "send_now">("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [articles, setArticles] = useState<Article[]>([{ id: makeId(), title: "", image: "", content: "" }]);
  const [pdfUrl, setPdfUrl] = useState("");
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState("");
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [pdfUploadError, setPdfUploadError] = useState("");
  const [embeddedItems, setEmbeddedItems] = useState<EmbeddedItem[]>([]);
  const [filterOptions, setFilterOptions] = useState<{ batches: string[]; departments: string[]; graduationYears: string[]; roles: string[] }>({ batches: [], departments: [], graduationYears: [], roles: [] });
  const [recipientPreview, setRecipientPreview] = useState<RecipientPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showRecipientsModal, setShowRecipientsModal] = useState(false);
  const [modalSearch, setModalSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const isSavingRef = useRef(false);
  const autosaveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewConfirmOpen, setPreviewConfirmOpen] = useState(false);
  const [pendingMode, setPendingMode] = useState<"schedule" | "send_now" | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stable per-tab session key prevents collision when two tabs create new newsletters simultaneously
  const sessionDraftId = useRef<string>(!isEdit ? `new_${Date.now()}` : "");
  const autosaveKey = AUTOSAVE_KEY_PREFIX + (newsletterId || sessionDraftId.current);

  // Fetch newsletter when editing
  useEffect(() => {
    if (!newsletterId) return;
    setLoadingNewsletter(true);
    fetch(`/api/admin/newsletters/${newsletterId}`, { headers: getHeaders() })
      .then((r) => r.json())
      .then((data) => {
        const nl: NewsletterDetail = data.newsletter;
        setNewsletter(nl);
        setTitle(nl.title || "");
        setExcerpt(nl.excerpt || "");
        setRecipientRole(nl.recipient_role || "all");
        setRecipientBatch(nl.recipient_batch || "all");
        setRecipientGradYear(nl.recipient_graduation_year || "all");
        setRecipientDepartment(nl.recipient_department || "all");
        if (nl.scheduled_at) {
          setScheduledAt(utcToLocalDatetimeLocal(nl.scheduled_at));
          setDeliveryMode("schedule");
        }
        // Parse articles
        if (nl.content) {
          const parsed = parseArticlesFromHtml(nl.content);
          if (parsed) setArticles(parsed);
          else setArticles([{ id: makeId(), title: "", image: "", content: nl.content }]);
          setEmbeddedItems(parseEmbeddedFromHtml(nl.content));
        }
        // Parse custom emails
        try {
          const raw: string[] = JSON.parse(nl.custom_recipient_emails || "[]");
          setCustomEmails(raw.map((email) => ({ uid: makeId(), email, name: "", isExternal: true })));
        } catch { /* ignore */ }
      })
      .catch(() => toast({ title: "Error", description: "Failed to load newsletter", variant: "destructive" }))
      .finally(() => setLoadingNewsletter(false));
  }, [newsletterId]);

  // Restore autosave draft (new newsletters only)
  // Also checks the legacy "newsletter_draft_new" key for backward compatibility
  useEffect(() => {
    if (!isEdit) {
      const legacyKey = AUTOSAVE_KEY_PREFIX + "new";
      const saved = localStorage.getItem(autosaveKey) || localStorage.getItem(legacyKey);
      if (saved) {
        try {
          const d = JSON.parse(saved);
          setHasDraft(true);
          setTitle(d.title || "");
          setExcerpt(d.excerpt || "");
          setRecipientRole(d.recipientRole || "all");
          setRecipientBatch(d.recipientBatch || "all");
          setRecipientGradYear(d.recipientGradYear || "all");
          setRecipientDepartment(d.recipientDepartment || "all");
          if (d.articles) setArticles(d.articles);
          if (d.embeddedItems) setEmbeddedItems(d.embeddedItems);
          if (d.customEmails) setCustomEmails(d.customEmails);
          // Migrate: remove legacy key if it was used
          if (localStorage.getItem(legacyKey)) {
            localStorage.removeItem(legacyKey);
            localStorage.setItem(autosaveKey, saved);
          }
        } catch { /* ignore */ }
      }
    }
  }, []);

  // Fetch filter options
  useEffect(() => {
    fetch("/api/admin/newsletters/filter-options", { headers: getHeaders() })
      .then((r) => r.json())
      .then((data) => { if (data.batches) setFilterOptions(data); })
      .catch(() => {});
  }, []);

  const attachPdf = () => {
    const trimmedUrl = pdfUrl.trim();
    if (!trimmedUrl) return;
    const normalized = normalizePdfUrl(trimmedUrl);
    const safeUrl = normalized.replace(/"/g, "%22");
    const thumbnail = driveThumbnailUrl(trimmedUrl);
    setEmbeddedItems((prev) => [...prev, {
      embedId: makeId(), type: "pdf",
      id: makeId(), title: pdfTitle.trim(),
      excerpt: "", coverImage: thumbnail ?? "", meta: "",
      url: safeUrl,
    }]);
    setPdfUrl(""); setPdfTitle(""); setPdfPreviewUrl("");
  };

  const uploadPdfFile = async (file: File) => {
    setPdfUploadError("");
    if (file.type !== "application/pdf") {
      setPdfUploadError("Only PDF files are allowed.");
      return;
    }
    setIsUploadingPdf(true);
    try {
      const headers = getHeaders();
      const { "Content-Type": _omit, ...uploadHeaders } = headers;
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload/newsletter-attachment", {
        method: "POST",
        headers: uploadHeaders,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) {
        setPdfUploadError(data.error || "Failed to upload PDF.");
        return;
      }
      setEmbeddedItems((prev) => [...prev, {
        embedId: makeId(), type: "pdf",
        id: makeId(), title: pdfTitle.trim() || file.name,
        excerpt: "", coverImage: "", meta: "",
        url: data.url,
      }]);
      setPdfTitle("");
    } catch {
      setPdfUploadError("Failed to upload PDF.");
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const getContent = () =>
    articlesToHtml(articles) + (embeddedItems.length ? "\n" + embeddedItemsToHtml(embeddedItems) : "");

  // Autosave
  useEffect(() => {
    if (!title && articles.every((a) => !a.content) && !embeddedItems.length) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    if (!isEdit) {
      autosaveTimerRef.current = setTimeout(() => {
        localStorage.setItem(autosaveKey, JSON.stringify({
          title, excerpt, articles, embeddedItems, recipientRole, recipientBatch, recipientGradYear, recipientDepartment, customEmails,
        }));
      }, 5000);
    } else if (newsletter?.status === "draft") {
      autosaveTimerRef.current = setTimeout(async () => {
        if (isSavingRef.current) return;
        setAutosaveStatus("saving");
        try {
          await fetch(`/api/admin/newsletters/${newsletterId}`, {
            method: "PUT", headers: getHeaders(),
            body: JSON.stringify({
              title, excerpt, content: getContent(),
              recipient_role: recipientRole, recipient_batch: recipientBatch,
              recipient_graduation_year: recipientGradYear, recipient_department: recipientDepartment,
              custom_recipient_emails: customEmails.map((e) => e.email),
            }),
          });
          setAutosaveStatus("saved");
        } catch {
          setAutosaveStatus("error");
        } finally {
          if (autosaveStatusTimerRef.current) clearTimeout(autosaveStatusTimerRef.current);
          autosaveStatusTimerRef.current = setTimeout(() => setAutosaveStatus("idle"), 3000);
        }
      }, 5000);
    }
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
  }, [title, excerpt, articles, embeddedItems, recipientRole, recipientBatch, recipientGradYear, recipientDepartment, customEmails]);

  const clearDraft = () => localStorage.removeItem(autosaveKey);

  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetches filter-based recipient count from the server (does not include custom emails)
  const previewRecipients = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/admin/newsletters/recipients/preview-filters", {
        method: "POST", headers: getHeaders(),
        body: JSON.stringify({ role: recipientRole, batch: recipientBatch, graduationYear: recipientGradYear, department: recipientDepartment }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      // Merge custom emails that aren't already in the server result
      const filterEmails = new Set((data.users ?? []).map((u: any) => u.email.toLowerCase()));
      const extraCount = customEmails.filter((e) => !filterEmails.has(e.email.toLowerCase())).length;
      setRecipientPreview({ count: data.count + extraCount, serverCount: data.count, users: data.users });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setPreviewLoading(false); }
  }, [recipientRole, recipientBatch, recipientGradYear, recipientDepartment, customEmails, getHeaders]);

  // Debounced auto-refresh when filter dropdowns change (400ms) — avoids rapid sequential requests
  useEffect(() => {
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    previewDebounceRef.current = setTimeout(() => previewRecipients(), 400);
    return () => { if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current); };
  }, [recipientRole, recipientBatch, recipientGradYear, recipientDepartment]);

  // When only custom emails change, recalculate the +N count client-side without hitting the server
  useEffect(() => {
    if (!recipientPreview) return;
    const filterEmails = new Set(recipientPreview.users.map((u) => u.email.toLowerCase()));
    const extraCount = customEmails.filter((e) => !filterEmails.has(e.email.toLowerCase())).length;
    setRecipientPreview((prev) => prev ? { ...prev, count: (prev.serverCount ?? prev.users.length) + extraCount } : prev);
  }, [customEmails]);

  // validate takes the mode being submitted so it doesn't read stale state
  const validate = (mode: "draft" | "schedule" | "send_now") => {
    if (!title.trim() || title.trim().length < 3) return "Title must be at least 3 characters";
    const hasPdf = embeddedItems.some((i) => i.type === "pdf");
    const allText = articles.map((a) => a.content.replace(/<[^>]*>/g, "").trim()).join(" ");
    if (!hasPdf && allText.length < 10) return "At least one article must have content (at least 10 characters)";
    if (mode === "schedule" && !scheduledAt) return "Scheduled date/time is required";
    if (mode === "schedule" && scheduledAt) {
      const utc = new Date(scheduledAt + "+05:30");
      if (utc <= new Date()) return "Scheduled time must be in the future";
    }
    return null;
  };

  const handleTestSend = async () => {
    if (!newsletterId) return;
    setTestSending(true);
    try {
      const res = await fetch(`/api/admin/newsletters/${newsletterId}/test-send`, { method: "POST", headers: getHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Test send failed");
      toast({ title: "Test email sent", description: `Sent to ${data.sentTo}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setTestSending(false); }
  };

  const handleSaveWithPreview = (mode: "draft" | "schedule" | "send_now") => {
    if (mode === "send_now" || mode === "schedule") {
      const err = validate(mode);
      if (err) { toast({ title: "Validation error", description: err, variant: "destructive" }); return; }
      setPendingMode(mode);
      setPreviewConfirmOpen(true);
      return;
    }
    handleSave("draft");
  };

  const handleSave = async (mode: "draft" | "schedule" | "send_now") => {
    const err = validate(mode);
    if (err) { toast({ title: "Validation error", description: err, variant: "destructive" }); return; }

    isSavingRef.current = true;
    setSaving(true);
    try {
      const body: Record<string, any> = {
        title: title.trim(),
        excerpt: excerpt.trim() || null,
        content: getContent(),
        recipient_role: recipientRole,
        recipient_batch: recipientBatch,
        recipient_graduation_year: recipientGradYear,
        recipient_department: recipientDepartment,
        custom_recipient_emails: customEmails.map((e) => e.email),
        status: mode === "schedule" ? "scheduled" : "draft",
        scheduled_at: mode === "schedule" ? scheduledAt : null,
      };

      const url = isEdit ? `/api/admin/newsletters/${newsletterId}` : "/api/admin/newsletters";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      const savedId = data.newsletter?.id ?? newsletterId;

      if (mode === "send_now" && savedId) {
        const sendRes = await fetch(`/api/admin/newsletters/${savedId}/send-now`, {
          method: "POST", headers: getHeaders(),
        });
        const sendData = await sendRes.json();
        if (sendRes.status !== 202 && !sendRes.ok) throw new Error(sendData.error || "Send failed");
        clearDraft();
        toast({ title: "Sending started", description: "Newsletter is being sent in the background" });
        navigate("/admin/newsletters");
        return;
      }

      clearDraft();
      toast({
        title: isEdit ? "Updated" : "Saved",
        description: mode === "schedule" ? "Newsletter scheduled successfully" : "Draft saved",
      });
      navigate("/admin/newsletters");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
      isSavingRef.current = false;
    }
  };

  const isPastDate = scheduledAt ? new Date(scheduledAt + "+05:30") <= new Date() : false;

  if (loadingNewsletter) {
    return (
      <div className="flex min-h-screen bg-gray-50">
        <AdminSidebar currentPage="newsletters" />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar currentPage="newsletters" />

      <div className="flex-1 overflow-auto min-w-0">
        {/* Page header */}
        <div className="bg-white border-b border-gray-200 px-6 py-5 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => navigate("/admin/newsletters")}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Back to newsletters"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="p-2.5 bg-sky-50 rounded-xl">
                <Newspaper className="w-6 h-6 text-sky-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">{isEdit ? "Edit Newsletter" : "New Newsletter"}</h1>
                <p className="text-sm text-gray-500">{isEdit ? "Update your newsletter draft" : "Create and send a newsletter to alumni"}</p>
              </div>
            </div>

            {/* Header action buttons */}
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={() => setPreviewOpen(true)} className="gap-2 xl:hidden">
                <Eye className="w-4 h-4" /> Preview
              </Button>
              {autosaveStatus === "saving" && <span className="text-xs text-gray-400 self-center">Saving draft…</span>}
              {autosaveStatus === "saved" && <span className="text-xs text-green-500 self-center">Draft saved</span>}
              {autosaveStatus === "error" && <span className="text-xs text-red-400 self-center">Autosave failed</span>}
              <Button variant="outline" onClick={() => navigate("/admin/newsletters")} disabled={saving}>Cancel</Button>
              <Button
                variant="outline"
                onClick={handleTestSend}
                disabled={!newsletterId || testSending || saving}
                title={!newsletterId ? "Save as draft first to enable test send" : "Send a test email to yourself"}
                className="gap-2 text-sky-600 border-sky-200 hover:bg-sky-50 disabled:opacity-50"
              >
                {testSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send Test
              </Button>
              {(deliveryMode === "schedule" || deliveryMode === "send_now") && (
                <Button variant="outline" onClick={() => handleSave("draft")} disabled={saving} className="gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save as Draft
                </Button>
              )}
              <Button
                onClick={() => handleSaveWithPreview(deliveryMode)}
                disabled={saving || (deliveryMode === "schedule" && isPastDate)}
                className="bg-[#008060] hover:bg-[#006b51] text-white gap-2"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : deliveryMode === "send_now" ? <Send className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                {deliveryMode === "schedule" ? "Schedule Newsletter" : deliveryMode === "send_now" ? "Send Now" : "Save Draft"}
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-6 px-6 py-8 items-start">
        {/* Left: composer */}
        <div className="flex-1 min-w-0 space-y-8">
          {/* Autosave draft banner */}
          {hasDraft && !isEdit && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3 text-sm text-blue-700 flex items-center justify-between">
              <span>Restored unsaved draft</span>
              <button onClick={() => { setHasDraft(false); clearDraft(); }} className="underline text-xs">Discard</button>
            </div>
          )}

          {/* Section 1: Content */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Content</h2>

            <div>
              <Label htmlFor="nl-title">Newsletter Title *</Label>
              <Input id="nl-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. TKS Alumni Newsletter – June 2026" maxLength={200} className="mt-1" />
            </div>

            <div>
              <Label htmlFor="nl-excerpt">Excerpt <span className="text-gray-400 font-normal">(optional)</span></Label>
              <Textarea id="nl-excerpt" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="A brief summary shown in the newsletter archive…" rows={2} maxLength={300} className="mt-1 resize-none" />
              <p className="text-xs text-gray-400 mt-1">{excerpt.length}/300</p>
            </div>


          </div>

          {/* Section 2: PDF Link */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">PDF Link</h2>
              {embeddedItems.some((i) => i.type === "pdf") && (
                <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">PDF attached</span>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <Label className="text-xs font-semibold text-gray-600">Label <span className="text-gray-400 font-normal">(optional)</span></Label>
                <input
                  type="text" value={pdfTitle}
                  onChange={(e) => setPdfTitle(e.target.value)}
                  placeholder="e.g. Annual Report 2025"
                  className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]/30 focus:border-[#008060]"
                />
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-600">Upload PDF</Label>
                <div className="mt-1 flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
                    {isUploadingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {isUploadingPdf ? "Uploading…" : "Choose PDF file"}
                    <input
                      type="file"
                      accept="application/pdf"
                      className="hidden"
                      disabled={isUploadingPdf}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadPdfFile(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
                {pdfUploadError && <p className="mt-1 text-xs text-red-500">{pdfUploadError}</p>}
              </div>
              <div>
                <Label className="text-xs font-semibold text-gray-600">Or paste a PDF URL <span className="text-gray-400 font-normal">(optional)</span></Label>
                <input
                  type="url" value={pdfUrl}
                  onChange={(e) => setPdfUrl(e.target.value)}
                  placeholder="Paste any PDF URL or Google Drive share link"
                  className="mt-1 w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]/30 focus:border-[#008060]"
                />
                <p className="mt-1 text-xs text-gray-400">Google Drive links are supported — just paste the share link as-is.</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPdfPreviewUrl(normalizePdfUrl(pdfUrl))}
                  disabled={!pdfUrl.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-md text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
                <button
                  type="button"
                  onClick={attachPdf}
                  disabled={!pdfUrl.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#008060] text-white rounded-md text-xs font-medium hover:bg-[#006b51] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Attach PDF
                </button>
              </div>
              {pdfPreviewUrl && (
                <div className="space-y-2">
                  <p className="text-xs text-amber-600 flex items-start gap-1">
                    <span className="mt-px">⚠</span>
                    <span>Preview may not display for all URLs due to browser security (X-Frame-Options). The email will always include a working link.</span>
                  </p>
                  <iframe
                    src={pdfPreviewUrl}
                    className="w-full h-72 rounded-lg border border-gray-200 bg-gray-50"
                    title="PDF Preview"
                  />
                </div>
              )}
              {embeddedItems.filter((i) => i.type === "pdf").map((item) => (
                <div key={item.embedId} className="flex items-center gap-2.5 p-2.5 border border-amber-200 rounded-lg bg-amber-50">
                  <FileText className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{item.title || item.url}</p>
                    <p className="text-xs text-amber-600">PDF Document</p>
                  </div>
                  <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-600 p-1" title="Preview"><Link2 className="w-3 h-3" /></a>
                  <button type="button" onClick={() => setEmbeddedItems((prev) => prev.filter((i) => i.embedId !== item.embedId))} className="text-gray-400 hover:text-red-500 p-1" title="Remove"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Articles */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Articles / Sections {embeddedItems.some((i) => i.type === "pdf") ? <span className="text-gray-400 font-normal normal-case text-xs">(optional — PDF attached)</span> : "*"}
                </Label>
                <span className="text-xs text-gray-400">{articles.length} article{articles.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-3">
                {articles.map((article, idx) => (
                  <ArticleEditorCard
                    key={article.id} article={article} index={idx} total={articles.length}
                    onChange={(updated) => setArticles((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))}
                    onRemove={() => setArticles((prev) => prev.filter((a) => a.id !== article.id))}
                    onMoveUp={() => setArticles((prev) => { const next = [...prev]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; return next; })}
                    onMoveDown={() => setArticles((prev) => { const next = [...prev]; [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; return next; })}
                  />
                ))}
              </div>
              <Button type="button" variant="outline" size="sm"
                onClick={() => setArticles((prev) => [...prev, { id: makeId(), title: "", image: "", content: "" }])}
                className="gap-2 w-full border-dashed text-[#008060] border-[#008060]/40 hover:bg-green-50">
                <Plus className="w-3.5 h-3.5" /> Add Article / Section
              </Button>
            </div>
          </div>

          {/* Section 4: Attach Content */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Attach Content</h2>
              {embeddedItems.filter((i) => i.type !== "pdf").length > 0 && (
                <span className="text-xs font-medium text-[#008060] bg-green-50 px-2 py-0.5 rounded-full">{embeddedItems.filter((i) => i.type !== "pdf").length} attached</span>
              )}
            </div>
            <p className="text-xs text-gray-400">Attach published blogs, podcasts, or feed posts to feature them in this newsletter.</p>
            <ContentPickerPanel
              getHeaders={getHeaders} attachedItems={embeddedItems}
              onAttach={(item) => setEmbeddedItems((prev) => [...prev, item])}
              onDetach={(embedId) => setEmbeddedItems((prev) => prev.filter((i) => i.embedId !== embedId))}
            />
          </div>

          {/* Section 5: Recipients */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
            <div>
              <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Recipients</h2>
              <p className="text-xs text-gray-400 mt-0.5">Send to all users matching filters below, plus any specific individuals added as custom recipients.</p>
            </div>

            {/* Filter-based */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filter-based</p>
                {previewLoading && (
                  <span className="flex items-center gap-1 text-xs text-gray-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating…
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs">Role</Label>
                  <Select value={recipientRole} onValueChange={setRecipientRole}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All roles</SelectItem>
                      {filterOptions.roles.map((r) => <SelectItem key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Batch</Label>
                  <Select value={recipientBatch} onValueChange={setRecipientBatch}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All batches</SelectItem>
                      {filterOptions.batches.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Graduation Year</Label>
                  <Select value={recipientGradYear} onValueChange={setRecipientGradYear}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All years</SelectItem>
                      {filterOptions.graduationYears.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Department</Label>
                  <Select value={recipientDepartment} onValueChange={setRecipientDepartment}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All departments</SelectItem>
                      {filterOptions.departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Active filter chips */}
              {[
                { key: "role", label: recipientRole, clear: () => setRecipientRole("all") },
                { key: "batch", label: recipientBatch, clear: () => setRecipientBatch("all") },
                { key: "year", label: recipientGradYear, clear: () => setRecipientGradYear("all") },
                { key: "dept", label: recipientDepartment, clear: () => setRecipientDepartment("all") },
              ].filter((c) => c.label !== "all").length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { key: "role", label: recipientRole, clear: () => setRecipientRole("all") },
                    { key: "batch", label: recipientBatch, clear: () => setRecipientBatch("all") },
                    { key: "year", label: recipientGradYear, clear: () => setRecipientGradYear("all") },
                    { key: "dept", label: recipientDepartment, clear: () => setRecipientDepartment("all") },
                  ].filter((c) => c.label !== "all").map((chip) => (
                    <span key={chip.key} className="inline-flex items-center gap-1 bg-[#008060]/10 text-[#008060] text-xs font-medium px-2.5 py-1 rounded-full">
                      {chip.label}
                      <button type="button" onClick={chip.clear} className="ml-0.5 hover:text-red-500 transition-colors">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Custom recipients */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Custom recipients</p>
                {customEmails.length > 0 && (
                  <span className="bg-green-50 text-[#008060] text-xs font-medium px-2 py-0.5 rounded-full">{customEmails.length}</span>
                )}
              </div>
              <CustomEmailsPanel
                getHeaders={getHeaders}
                customEmails={customEmails}
                onChange={setCustomEmails}
              />
            </div>

            {/* Total recipient count */}
            {(recipientPreview || customEmails.length > 0) && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-gray-700">
                    <span className="font-semibold text-gray-900">{recipientPreview?.count ?? 0}</span> filter-matched
                    {customEmails.length > 0 && (
                      <> + <span className="font-semibold text-gray-900">{customEmails.length}</span> custom</>
                    )}
                    {" "}= <span className="font-semibold text-[#008060]">{(recipientPreview?.count ?? 0) + customEmails.length} total</span>
                  </span>
                </div>
                <Button variant="ghost" size="sm" className="text-[#008060] hover:text-[#006048] h-7 px-2 text-xs"
                  onClick={() => { setModalSearch(""); setShowRecipientsModal(true); }}>
                  View sample
                </Button>
              </div>
            )}

            {/* Recipients preview modal */}
            <Dialog open={showRecipientsModal} onOpenChange={(open) => { setShowRecipientsModal(open); if (!open) setModalSearch(""); }}>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Recipients Preview</DialogTitle>
                  <p className="text-xs text-gray-500 mt-1">
                    Showing a sample of up to 500 filter-matched users. Total estimated:{" "}
                    <strong>{recipientPreview?.count ?? 0}</strong> (filter) + <strong>{customEmails.length}</strong> (custom) = <strong>{(recipientPreview?.count ?? 0) + customEmails.length}</strong>
                  </p>
                </DialogHeader>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                  <input
                    value={modalSearch} onChange={(e) => setModalSearch(e.target.value)}
                    placeholder="Filter this list…"
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#008060]/30 focus:border-[#008060]"
                  />
                </div>
                <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                  {recipientPreview && recipientPreview.users.length > 0 && (() => {
                    const q = modalSearch.toLowerCase();
                    const filtered = q
                      ? recipientPreview.users.filter((u) => u.name?.toLowerCase().includes(q) || u.email.toLowerCase().includes(q))
                      : recipientPreview.users;
                    return filtered.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          Filter-matched ({recipientPreview.serverCount ?? recipientPreview.users.length}){q && ` — showing ${filtered.length} match${filtered.length !== 1 ? "es" : ""}`}
                        </p>
                        <ul className="divide-y divide-gray-100 border rounded-md">
                          {filtered.map((u) => (
                            <li key={u.id} className="flex items-center gap-3 px-3 py-2">
                              <RecipientInitials name={u.name} email={u.email} variant="internal" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{u.name || "—"}</p>
                                <p className="text-xs text-gray-500 truncate">{u.email}</p>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null;
                  })()}
                  {customEmails.length > 0 && (() => {
                    const q = modalSearch.toLowerCase();
                    const filtered = q
                      ? customEmails.filter((e) => e.name?.toLowerCase().includes(q) || e.email.toLowerCase().includes(q))
                      : customEmails;
                    return filtered.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                          Custom recipients ({customEmails.length}){q && ` — showing ${filtered.length}`}
                        </p>
                        <ul className="divide-y divide-gray-100 border rounded-md">
                          {filtered.map((e) => (
                            <li key={e.uid} className="flex items-center gap-3 px-3 py-2">
                              <RecipientInitials name={e.name} email={e.email} variant={e.isExternal ? "external" : "internal"} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{e.name || e.email}</p>
                                {e.name && <p className="text-xs text-gray-500 truncate">{e.email}</p>}
                              </div>
                              {e.isExternal && <span className="text-[10px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">External</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null;
                  })()}
                  {(!recipientPreview || recipientPreview.users.length === 0) && customEmails.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No recipients found.</p>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" size="sm" onClick={() => setShowRecipientsModal(false)}>Close</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {/* Section 4: Delivery */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Delivery</h2>
            <div className="flex gap-3">
              {(["draft", "schedule", "send_now"] as const).map((mode) => {
                const labels = {
                  draft: { title: "Save as Draft", sub: "Send manually later" },
                  schedule: { title: "Schedule", sub: "Auto-send at a specific time" },
                  send_now: { title: "Send Now", sub: "Publish & send immediately" },
                };
                return (
                  <button key={mode} type="button" onClick={() => setDeliveryMode(mode)}
                    className={`flex-1 border rounded-md p-3 text-sm text-left transition-colors ${deliveryMode === mode ? "border-[#008060] bg-green-50 text-[#008060]" : "border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                    <div className="font-medium flex items-center gap-1.5">
                      {mode === "send_now" && <Send className="w-3.5 h-3.5" />}
                      {labels[mode].title}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{labels[mode].sub}</div>
                  </button>
                );
              })}
            </div>
            {deliveryMode === "schedule" && (
              <div>
                <Label htmlFor="nl-schedule" className="text-xs">Date & Time (IST)</Label>
                <Input id="nl-schedule" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)}
                  className={`mt-1 ${isPastDate ? "border-red-400" : ""}`}
                  min={(() => { const nowIST = new Date(Date.now() + 5.5 * 60 * 60 * 1000); return nowIST.toISOString().slice(0, 16); })()}
                />
                {isPastDate && <p className="text-xs text-red-500 mt-1">Scheduled time is in the past</p>}
                <p className="text-xs text-gray-400 mt-1">Times are in IST (Asia/Kolkata, UTC+05:30)</p>
              </div>
            )}
          </div>

          {/* Bottom action bar */}
          <div className="flex justify-end gap-3 pb-8">
            <Button variant="outline" onClick={() => navigate("/admin/newsletters")} disabled={saving}>Cancel</Button>
            {(deliveryMode === "schedule" || deliveryMode === "send_now") && (
              <Button variant="outline" onClick={() => handleSave("draft")} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Save as Draft Instead
              </Button>
            )}
            <Button
              onClick={() => handleSaveWithPreview(deliveryMode)}
              disabled={saving || (deliveryMode === "schedule" && isPastDate)}
              className="bg-[#008060] hover:bg-[#006b51] text-white gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : deliveryMode === "send_now" ? <Send className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              {deliveryMode === "schedule" ? "Schedule Newsletter" : deliveryMode === "send_now" ? "Send Now" : "Save Draft"}
            </Button>
          </div>
        </div>{/* end left composer col */}

        {/* Right: live preview panel — visible on xl+ */}
        <div className="hidden xl:flex flex-col w-[420px] flex-shrink-0 sticky top-[81px] max-h-[calc(100vh-81px)] overflow-y-auto">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
              <span className="ml-2 text-xs font-medium text-gray-400 tracking-wide">Live Preview</span>
            </div>
            <NewsletterPreviewBody
              title={title} excerpt={excerpt}
              articles={articles} embeddedItems={embeddedItems}
              recipientPreview={recipientPreview} previewLoading={previewLoading}
              recipientRole={recipientRole} recipientBatch={recipientBatch}
              recipientGradYear={recipientGradYear} recipientDepartment={recipientDepartment}
              customEmails={customEmails}
            />
          </div>
        </div>{/* end right preview col */}

        </div>{/* end flex row */}
      </div>

      {/* Preview slide-over for screens below xl */}
      <Sheet open={previewOpen} onOpenChange={setPreviewOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
          <SheetHeader className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <SheetTitle className="text-xs font-medium text-gray-400 tracking-wide">Live Preview</SheetTitle>
          </SheetHeader>
          <NewsletterPreviewBody
            title={title} excerpt={excerpt}
            articles={articles} embeddedItems={embeddedItems}
            recipientPreview={recipientPreview} previewLoading={previewLoading}
            recipientRole={recipientRole} recipientBatch={recipientBatch}
            recipientGradYear={recipientGradYear} recipientDepartment={recipientDepartment}
            customEmails={customEmails}
          />
        </SheetContent>
      </Sheet>

      {/* Preview confirm dialog */}
      <Dialog open={previewConfirmOpen} onOpenChange={(o) => { if (!o) { setPreviewConfirmOpen(false); setPendingMode(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gray-900">
              <CheckCircle className="w-5 h-5 text-[#008060]" />
              Confirm &amp; {pendingMode === "send_now" ? "Send" : "Schedule"} Newsletter
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-gray-500">
              Review the newsletter below before confirming. This action{" "}
              {pendingMode === "send_now" ? "will immediately send emails to all recipients" : "will schedule the newsletter for delivery"}.
            </p>

            {/* Preview card */}
            <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
              <div className="p-5 space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 leading-tight">{title || <span className="text-gray-400 italic">Untitled</span>}</h2>
                  {excerpt && <p className="text-sm text-gray-500 italic mt-1">{excerpt}</p>}
                </div>
                {articles.map((a, i) => (
                  <div key={a.id} className={i > 0 ? "border-t border-gray-100 pt-4" : ""}>
                    {a.title && <h3 className="text-base font-semibold text-gray-800 mb-2">{a.title}</h3>}
                    {a.image && <img src={a.image} alt="" className="rounded-md mb-2 max-h-32 object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />}
                    <div className="prose prose-sm max-w-none text-gray-700" dangerouslySetInnerHTML={{ __html: a.content }} />
                  </div>
                ))}
                {embeddedItems.length > 0 && (
                  <div className="border-t border-gray-100 pt-4 space-y-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Attached Content</p>
                    {embeddedItems.map((item) => {
                      const cfg = EMBED_TYPE_CONFIG[item.type]; const Icon = cfg.icon;
                      return (
                        <div key={item.embedId} className={`flex items-start gap-3 p-3 rounded-lg border border-gray-100 ${cfg.bgColor}`}>
                          <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 bg-white border border-gray-200"><Icon className={`w-4 h-4 ${cfg.color}`} /></div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${cfg.color}`}>{cfg.label}</p>
                            <p className="text-sm font-medium text-gray-900 leading-snug">{item.title || item.excerpt.slice(0, 80) || "Untitled"}</p>
                            {item.meta && <p className="text-xs text-gray-400 mt-0.5">{item.meta}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Meta summary */}
            <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <Users className="w-4 h-4 flex-shrink-0 text-gray-400" />
                <span>
                  Recipients:{" "}
                  <span className="font-medium text-gray-800">
                    {[
                      recipientRole !== "all" ? recipientRole : null,
                      recipientBatch !== "all" ? recipientBatch : null,
                      recipientGradYear !== "all" ? `Class of ${recipientGradYear}` : null,
                      recipientDepartment !== "all" ? recipientDepartment : null,
                    ].filter(Boolean).join(" · ") || "All alumni"}
                  </span>
                  {customEmails.length > 0 && <span className="ml-2 text-gray-500">+ {customEmails.length} custom</span>}
                  {recipientPreview && <span className="ml-2 text-gray-500">({recipientPreview.count} matched)</span>}
                </span>
              </div>
              {pendingMode === "schedule" && scheduledAt && (
                <div className="flex items-center gap-2 text-gray-600">
                  <Calendar className="w-4 h-4 flex-shrink-0 text-gray-400" />
                  <span>Scheduled for: <span className="font-medium text-gray-800">{new Date(scheduledAt + "+05:30").toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })} IST</span></span>
                </div>
              )}
              {pendingMode === "send_now" && (
                <div className="flex items-center gap-2 text-amber-600">
                  <Send className="w-4 h-4 flex-shrink-0" />
                  <span className="font-medium">Will be sent immediately upon confirmation</span>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => { setPreviewConfirmOpen(false); setPendingMode(null); }} disabled={saving}>
              Go Back &amp; Edit
            </Button>
            <Button
              onClick={() => { setPreviewConfirmOpen(false); handleSave(pendingMode!); setPendingMode(null); }}
              disabled={saving}
              className="bg-[#008060] hover:bg-[#006b51] text-white gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : pendingMode === "send_now" ? <Send className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              {pendingMode === "send_now" ? "Yes, Send Now" : "Yes, Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
