import React, { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Plus, Send, Save, ImageIcon, Upload, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { clientConfig } from "@/lib/config";

// TipTap core
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight, common } from "lowlight";

const lowlight = createLowlight(common);

// ── Validation schema ──────────────────────────────────────────────────────────
const EXCERPT_LIMIT = 50;

const blogPostSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  excerpt: z.string().max(EXCERPT_LIMIT, `Excerpt must be under ${EXCERPT_LIMIT} characters`).optional(),
  cover_image: z.string().optional().or(z.literal("")),
  category_id: z.string().optional(),
});

type BlogPostForm = z.infer<typeof blogPostSchema>;

// ── Types ──────────────────────────────────────────────────────────────────────
interface BlogEditorProps {
  open: boolean;
  onClose: () => void;
  onSaved: (post: any) => void;
  categories: any[];
  editPost?: any;
}

// ── TipTap Toolbar ─────────────────────────────────────────────────────────────
function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`px-2 py-1 rounded text-sm font-medium transition-colors ${
        active
          ? "bg-[#008060] text-white"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}

function EditorToolbar({ editor }: { editor: any }) {
  const addLink = () => {
    const url = window.prompt("Enter URL:");
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url, target: "_blank" }).run();
    }
  };

  const addImage = () => {
    const url = window.prompt("Enter image URL:");
    if (url) editor.chain().focus().setImage({ src: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-gray-200 bg-gray-50 rounded-t-md">
      <ToolbarButton title="Heading 1" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })}>H1</ToolbarButton>
      <ToolbarButton title="Heading 2" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })}>H2</ToolbarButton>
      <ToolbarButton title="Heading 3" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })}>H3</ToolbarButton>

      <span className="w-px h-5 bg-gray-300 mx-1" />

      <ToolbarButton title="Bold" onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")}><strong>B</strong></ToolbarButton>
      <ToolbarButton title="Italic" onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")}><em>I</em></ToolbarButton>
      <ToolbarButton title="Strikethrough" onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")}><s>S</s></ToolbarButton>
      <ToolbarButton title="Inline code" onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")}><code className="font-mono text-xs">`c`</code></ToolbarButton>

      <span className="w-px h-5 bg-gray-300 mx-1" />

      <ToolbarButton title="Bullet list" onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")}>• List</ToolbarButton>
      <ToolbarButton title="Numbered list" onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")}>1. List</ToolbarButton>
      <ToolbarButton title="Blockquote" onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")}>" Quote</ToolbarButton>
      <ToolbarButton title="Code block" onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")}>{"</>"}</ToolbarButton>

      <span className="w-px h-5 bg-gray-300 mx-1" />

      <ToolbarButton title="Insert link" onClick={addLink} active={editor.isActive("link")}>🔗</ToolbarButton>
      <ToolbarButton title="Insert image (URL)" onClick={addImage}>🖼</ToolbarButton>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function BlogEditor({ open, onClose, onSaved, categories, editPost }: BlogEditorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Cover image
  const [coverPreview, setCoverPreview] = useState<string>("");
  const [uploadingCover, setUploadingCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-save draft restore banner
  const [draftBanner, setDraftBanner] = useState<{ timestamp: string } | null>(null);

  // Track whether content was initialized to avoid overwriting on re-renders
  const editorInitialized = useRef(false);

  // Use a stable session-scoped key for new posts so concurrent tabs don't overwrite each other
  const sessionDraftId = useRef<string>(Math.random().toString(36).substring(2, 9));
  const draftKey = editPost ? `blog_draft_${editPost.id}` : `blog_draft_new_${sessionDraftId.current}`;

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    watch,
    reset,
    formState: { errors },
  } = useForm<BlogPostForm>({
    resolver: zodResolver(blogPostSchema),
    defaultValues: { title: "", excerpt: "", cover_image: "", category_id: "" },
  });

  const CONTENT_MIN_WORDS = 10;
  const CONTENT_MAX_WORDS = 1000;

  // Tracked in state so React re-renders on every keystroke
  const [contentText, setContentText] = useState("");
  const [contentTouched, setContentTouched] = useState(false);
  const [, forceToolbarUpdate] = useState(0);

  // ── TipTap editor ──────────────────────────────────────────────────────────
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        undoRedo: { newGroupDelay: 0 },
      }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      CodeBlockLowlight.configure({ lowlight }),
    ],
    content: "",
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none min-h-[260px] p-3 focus:outline-none text-gray-800",
      },
    },
    onUpdate({ editor }) {
      const text = editor.getText();
      setContentText(text);
      setContentTouched(true);
      forceToolbarUpdate(n => n + 1);
    },
    onSelectionUpdate() {
      forceToolbarUpdate(n => n + 1);
    },
  });

  // Word count derived from live contentText
  const wordCount = contentText.trim() ? contentText.trim().split(/\s+/).length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const contentOverLimit = wordCount > CONTENT_MAX_WORDS;
  const contentUnderMin = contentTouched && wordCount < CONTENT_MIN_WORDS;
  const contentInvalid = contentOverLimit || contentUnderMin;

  const getHeaders = () => {
    const token = localStorage.getItem("auth_token") || "";
    return {
      "Content-Type": "application/json",
      "user-id": user?.id || localStorage.getItem("userId") || "",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // ── Populate form when dialog opens ───────────────────────────────────────
  // Runs when `open` changes to true, or when `editor` becomes available.
  // `editorInitialized` prevents double-setting on rapid re-renders.
  useEffect(() => {
    if (!open || !editor) return;
    if (editorInitialized.current) return;
    editorInitialized.current = true;

    if (editPost) {
      reset({
        title: editPost.title || "",
        excerpt: editPost.excerpt || "",
        cover_image: editPost.cover_image || "",
        category_id: editPost.category_id || "",
      });
      setCoverPreview(editPost.cover_image || "");
      setTags(editPost.tags || []);
      editor.commands.setContent(editPost.content || "");
      setContentText(editor.getText());
    } else {
      reset({ title: "", excerpt: "", cover_image: "", category_id: "" });
      setTags([]);
      setCoverPreview("");
      editor.commands.setContent("");
      setContentText("");
    }
    setContentTouched(false);

    // Check localStorage for auto-saved draft
    const saved = localStorage.getItem(draftKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setDraftBanner({ timestamp: parsed.savedAt });
      } catch {
        localStorage.removeItem(draftKey);
      }
    } else {
      setDraftBanner(null);
    }
  }, [open, editor]); // editor is stable after first mount; this re-runs if editor becomes ready after open

  // Reset the initialization flag when the dialog closes so next open re-populates
  useEffect(() => {
    if (!open) {
      editorInitialized.current = false;
    }
  }, [open]);

  // ── Auto-save to localStorage every 30s ───────────────────────────────────
  // Uses getValues() (stable ref) instead of watch() to avoid stale closures
  const autoSave = useCallback(() => {
    if (!open) return;
    const values = getValues();
    const content = editor?.getHTML() ?? "";
    // Don't save if content is trivially empty
    const textContent = content.replace(/<[^>]*>/g, "").trim();
    if (!values.title && !textContent) return;
    const data = {
      title: values.title,
      excerpt: values.excerpt,
      cover_image: values.cover_image,
      category_id: values.category_id,
      content,
      tags,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(draftKey, JSON.stringify(data));
  }, [open, editor, tags, getValues, draftKey]);

  useEffect(() => {
    if (!open) return;
    const interval = setInterval(autoSave, 30000);
    return () => clearInterval(interval);
  }, [open, autoSave]);

  const restoreDraft = () => {
    const saved = localStorage.getItem(draftKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      reset({
        title: parsed.title || "",
        excerpt: parsed.excerpt || "",
        cover_image: parsed.cover_image || "",
        category_id: parsed.category_id || "",
      });
      setCoverPreview(parsed.cover_image || "");
      setTags(parsed.tags || []);
      if (editor) {
        editor.commands.setContent(parsed.content || "");
        setContentText(editor.getText());
      }
    } catch {}
    setContentTouched(false);
    setDraftBanner(null);
  };

  const discardDraft = () => {
    localStorage.removeItem(draftKey);
    setDraftBanner(null);
  };

  // ── Cover image upload ─────────────────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    const formData = new FormData();
    formData.append("image", file);

    try {
      const token = localStorage.getItem("auth_token") || "";
      const res = await fetch(`${clientConfig.apiUrl}/api/blogs/upload-cover`, {
        method: "POST",
        headers: {
          "user-id": user?.id || localStorage.getItem("userId") || "",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      const { url } = await res.json();
      setValue("cover_image", url, { shouldValidate: true });
      setCoverPreview(url);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally {
      setUploadingCover(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Tags ──────────────────────────────────────────────────────────────────
  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (t && !tags.includes(t) && tags.length < 10) setTags([...tags, t]);
    setTagInput("");
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  // ── Save / submit ─────────────────────────────────────────────────────────
  const savePost = async (data: BlogPostForm, status: "draft" | "pending_review") => {
    const content = editor?.getHTML() ?? "";
    const textContent = editor?.getText().trim() ?? "";
    const wc = textContent ? textContent.split(/\s+/).length : 0;
    setContentTouched(true);
    if (wc < CONTENT_MIN_WORDS) throw new Error(`Content must be at least ${CONTENT_MIN_WORDS} words (currently ${wc})`);
    if (wc > CONTENT_MAX_WORDS) throw new Error(`Content must be ${CONTENT_MAX_WORDS} words or fewer (currently ${wc})`);

    const body = {
      ...data,
      content,
      tags,
      cover_image: data.cover_image || null,
      category_id: data.category_id || null,
    };

    const isEdit = !!editPost;
    const url = isEdit
      ? `${clientConfig.apiUrl}/api/blogs/${editPost.id}`
      : `${clientConfig.apiUrl}/api/blogs`;

    const res = await fetch(url, {
      method: isEdit ? "PUT" : "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to save");
    }
    const post = await res.json();

    if (status === "pending_review") {
      const pubRes = await fetch(`${clientConfig.apiUrl}/api/blogs/${post.id}/publish`, {
        method: "POST",
        headers: getHeaders(),
      });
      if (!pubRes.ok) {
        const err = await pubRes.json().catch(() => ({}));
        throw new Error(err.error || "Failed to submit for review");
      }
      return pubRes.json();
    }

    return post;
  };

  const handleClose = () => {
    // Save draft before closing (only if there is meaningful content)
    autoSave();
    onClose();
  };

  const onSaveDraft = handleSubmit(async (data) => {
    setSaving(true);
    try {
      const post = await savePost(data, "draft");
      localStorage.removeItem(draftKey);
      toast({ title: "Draft saved", description: "Your post has been saved as a draft." });
      onSaved(post);
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  });

  const onSubmitForReview = handleSubmit(async (data) => {
    setSubmitting(true);
    try {
      const post = await savePost(data, "pending_review");
      localStorage.removeItem(draftKey);
      toast({ title: "Submitted for review", description: "Your post will be published once approved." });
      onSaved(post);
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  });

  // Watched value for cover_image URL input (for live preview when pasted)
  const coverImageValue = watch("cover_image") || "";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editPost ? "Edit Blog Post" : "Write a Blog Post"}</DialogTitle>
          <DialogDescription>
            {editPost && ["published", "pending_review"].includes(editPost.status)
              ? "Saving changes will move this post back to draft and require re-approval."
              : "Share your knowledge and experiences with the TKS community."}
          </DialogDescription>
        </DialogHeader>

        {/* Auto-save restore banner */}
        {draftBanner && (
          <div className="flex items-center gap-3 bg-yellow-50 border border-yellow-300 rounded-lg px-4 py-2.5 text-sm text-yellow-800">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="flex-1">
              Unsaved draft from {new Date(draftBanner.timestamp).toLocaleString()}. Restore it?
            </span>
            <button
              type="button"
              onClick={restoreDraft}
              className="font-semibold underline underline-offset-2 hover:text-yellow-900"
            >
              Restore
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="text-yellow-600 hover:text-yellow-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="space-y-4 pt-1">
          {/* Title */}
          <div className="space-y-1">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="Enter a compelling title..."
              {...register("title")}
              className={errors.title ? "border-red-400" : ""}
            />
            {errors.title && <p className="text-xs text-red-500">{errors.title.message}</p>}
          </div>

          {/* Excerpt */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="excerpt">
                Excerpt <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <span className={`text-xs tabular-nums ${(watch("excerpt")?.length ?? 0) > EXCERPT_LIMIT ? "text-red-500 font-medium" : (watch("excerpt")?.length ?? 0) >= EXCERPT_LIMIT * 0.8 ? "text-amber-500" : "text-gray-400"}`}>
                {watch("excerpt")?.length ?? 0}/{EXCERPT_LIMIT}
              </span>
            </div>
            <Textarea
              id="excerpt"
              placeholder="A short summary that appears in the blog listing..."
              rows={2}
              {...register("excerpt")}
              maxLength={EXCERPT_LIMIT}
              className={`resize-none ${errors.excerpt ? "border-red-400" : ""}`}
            />
            {errors.excerpt && <p className="text-xs text-red-500">{errors.excerpt.message}</p>}
          </div>

          {/* Category + Cover Image */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Category</Label>
              <Select
                value={watch("category_id") || "none"}
                onValueChange={(v) => setValue("category_id", v === "none" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No category</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>
                <span className="flex items-center gap-1">
                  <ImageIcon className="h-3.5 w-3.5" /> Cover Image
                </span>
              </Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  {/* Controlled input: use value+onChange instead of register to keep coverPreview in sync */}
                  <Input
                    placeholder="https://... or upload below"
                    value={coverImageValue}
                    onChange={(e) => {
                      setValue("cover_image", e.target.value, { shouldValidate: true });
                      setCoverPreview(e.target.value);
                    }}
                    className={errors.cover_image ? "border-red-400" : ""}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Upload image file"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingCover}
                    className="flex-shrink-0"
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                {uploadingCover && <p className="text-xs text-gray-400">Uploading...</p>}
                {errors.cover_image && <p className="text-xs text-red-500">{errors.cover_image.message}</p>}
                {coverPreview && !errors.cover_image && (
                  <div className="relative w-full h-24 rounded overflow-hidden bg-gray-100">
                    <img
                      src={coverPreview}
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setValue("cover_image", "", { shouldValidate: true });
                        setCoverPreview("");
                      }}
                      className="absolute top-1 right-1 bg-white rounded-full p-0.5 shadow hover:bg-gray-100"
                    >
                      <X className="h-3.5 w-3.5 text-gray-600" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>Tags</Label>
              <span className="text-xs text-gray-400">up to 10</span>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. leadership, design, tech…"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={addTag} className="flex-shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tagInput.length > 0 && (
              <p className="text-xs text-[#008060] flex items-center gap-1">
                <kbd className="inline-flex items-center px-1.5 py-0.5 rounded border border-[#008060]/30 bg-[#008060]/5 font-mono text-[10px] leading-none">↵ Enter</kbd>
                to add · separate multiple tags one at a time
              </p>
            )}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                    #{tag}
                    <button onClick={() => removeTag(tag)} className="hover:text-red-500 ml-0.5">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Rich Text Editor */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label>Content *</Label>
              <span className="text-xs text-gray-400">{wordCount} words · ~{readingTime} min read</span>
            </div>
            <div className={`border rounded-md overflow-hidden focus-within:ring-2 focus-within:ring-[#008060]/30 focus-within:border-[#008060] ${contentInvalid ? "border-red-400" : "border-gray-200"}`}>
              {editor && <EditorToolbar editor={editor} />}
              <EditorContent editor={editor} />
            </div>
            <div className="flex items-center justify-between">
              {contentOverLimit ? (
                <p className="text-xs text-red-500">Content exceeds {CONTENT_MAX_WORDS} word limit</p>
              ) : contentUnderMin ? (
                <p className="text-xs text-red-500">Content must be at least {CONTENT_MIN_WORDS} words</p>
              ) : (
                <p className="text-xs text-gray-400">Min {CONTENT_MIN_WORDS} · Max {CONTENT_MAX_WORDS} words</p>
              )}
              <span className={`text-xs tabular-nums font-medium ${contentOverLimit ? "text-red-500" : wordCount > CONTENT_MAX_WORDS * 0.9 ? "text-amber-500" : wordCount >= CONTENT_MIN_WORDS ? "text-[#008060]" : "text-gray-400"}`}>
                {wordCount}/{CONTENT_MAX_WORDS} words
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={handleClose} disabled={saving || submitting}>Cancel</Button>
            <Button
              variant="outline"
              onClick={onSaveDraft}
              disabled={saving || submitting || contentInvalid}
              className="border-gray-300"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              onClick={onSubmitForReview}
              disabled={saving || submitting || contentInvalid}
              className="bg-[#008060] hover:bg-[#006b51]"
            >
              <Send className="h-4 w-4 mr-2" />
              {submitting ? "Submitting..." : "Submit for Review"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
