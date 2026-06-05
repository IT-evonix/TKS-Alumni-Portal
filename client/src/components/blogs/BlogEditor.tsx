import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Plus, Send, Save, ImageIcon } from "lucide-react";
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

const blogPostSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  excerpt: z.string().max(300, "Excerpt must be under 300 characters").optional(),
  content: z.string().min(100, "Content must be at least 100 characters"),
  cover_image: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  category_id: z.string().optional(),
});

type BlogPostForm = z.infer<typeof blogPostSchema>;

interface BlogEditorProps {
  open: boolean;
  onClose: () => void;
  onSaved: (post: any) => void;
  categories: any[];
  editPost?: any;
}

export function BlogEditor({ open, onClose, onSaved, categories, editPost }: BlogEditorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<BlogPostForm>({
    resolver: zodResolver(blogPostSchema),
    defaultValues: { title: "", excerpt: "", content: "", cover_image: "", category_id: "" },
  });

  const contentValue = watch("content");
  const wordCount = contentValue ? contentValue.split(/\s+/).filter(Boolean).length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  useEffect(() => {
    if (editPost) {
      reset({
        title: editPost.title || "",
        excerpt: editPost.excerpt || "",
        content: editPost.content || "",
        cover_image: editPost.cover_image || "",
        category_id: editPost.category_id || "",
      });
      setTags(editPost.tags || []);
    } else {
      reset({ title: "", excerpt: "", content: "", cover_image: "", category_id: "" });
      setTags([]);
    }
  }, [editPost, open]);

  const getHeaders = () => {
    const token = localStorage.getItem("auth_token") || "";
    return {
      "Content-Type": "application/json",
      "user-id": user?.id || localStorage.getItem("userId") || "",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (t && !tags.includes(t) && tags.length < 10) {
      setTags([...tags, t]);
    }
    setTagInput("");
  };

  const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));

  const savePost = async (data: BlogPostForm, status: "draft" | "pending_review") => {
    const body = {
      ...data,
      tags,
      cover_image: data.cover_image || null,
      category_id: data.category_id || null,
    };

    const isEdit = !!editPost;
    const url = isEdit
      ? `${clientConfig.apiUrl}/api/blogs/${editPost.id}`
      : `${clientConfig.apiUrl}/api/blogs`;
    const method = isEdit ? "PUT" : "POST";

    const res = await fetch(url, { method, headers: getHeaders(), body: JSON.stringify(body) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Failed to save");
    }
    const post = await res.json();

    // If submitting for review, call publish endpoint
    if (status === "pending_review") {
      const pubRes = await fetch(`${clientConfig.apiUrl}/api/blogs/${post.id}/publish`, {
        method: "POST",
        headers: getHeaders(),
      });
      if (!pubRes.ok) throw new Error("Failed to submit for review");
      return pubRes.json();
    }

    return post;
  };

  const onSaveDraft = handleSubmit(async (data) => {
    setSaving(true);
    try {
      const post = await savePost(data, "draft");
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
      toast({ title: "Submitted for review", description: "Your post will be published once approved." });
      onSaved(post);
      onClose();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editPost ? "Edit Blog Post" : "Write a Blog Post"}</DialogTitle>
          <DialogDescription>
            Share your knowledge and experiences with the TKS community.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
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
            <Label htmlFor="excerpt">Excerpt <span className="text-gray-400 font-normal">(optional)</span></Label>
            <Textarea
              id="excerpt"
              placeholder="A short summary that appears in the blog listing..."
              rows={2}
              {...register("excerpt")}
              className={`resize-none ${errors.excerpt ? "border-red-400" : ""}`}
            />
            {errors.excerpt && <p className="text-xs text-red-500">{errors.excerpt.message}</p>}
          </div>

          {/* Category + Cover Image row */}
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
              <Label htmlFor="cover_image">
                <span className="flex items-center gap-1"><ImageIcon className="h-3.5 w-3.5" /> Cover Image URL</span>
              </Label>
              <Input
                id="cover_image"
                placeholder="https://..."
                {...register("cover_image")}
                className={errors.cover_image ? "border-red-400" : ""}
              />
              {errors.cover_image && <p className="text-xs text-red-500">{errors.cover_image.message}</p>}
            </div>
          </div>

          {/* Tags */}
          <div className="space-y-1">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Add a tag (press Enter)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                className="flex-1"
              />
              <Button type="button" variant="outline" size="icon" onClick={addTag} className="flex-shrink-0">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
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

          {/* Content */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="content">Content *</Label>
              <span className="text-xs text-gray-400">{wordCount} words · ~{readingTime} min read</span>
            </div>
            <Textarea
              id="content"
              placeholder="Write your article here... You can use plain text and line breaks for formatting."
              rows={14}
              {...register("content")}
              className={`resize-none font-mono text-sm ${errors.content ? "border-red-400" : ""}`}
            />
            {errors.content && <p className="text-xs text-red-500">{errors.content.message}</p>}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button variant="outline" onClick={onClose} disabled={saving || submitting}>Cancel</Button>
            <Button
              variant="outline"
              onClick={onSaveDraft}
              disabled={saving || submitting}
              className="border-gray-300"
            >
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              onClick={onSubmitForReview}
              disabled={saving || submitting}
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
