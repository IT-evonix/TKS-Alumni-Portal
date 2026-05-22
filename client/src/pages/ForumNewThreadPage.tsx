import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, X, Lock } from "lucide-react";

interface Category {
    id: string;
    name: string;
    icon: string;
    color: string;
}

export const ForumNewThreadPage = (): JSX.Element => {
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const { user } = useAuth();
    const [categories, setCategories] = useState<Category[]>([]);
    const [title, setTitle] = useState("");
    const [content, setContent] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [threadType, setThreadType] = useState("discussion");
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isCategoryLocked, setIsCategoryLocked] = useState(false);
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        document.title = "New Thread - Forums - TKS Alumni Portal";
        fetchCategories();

        // Check for categoryId in URL
        const params = new URLSearchParams(window.location.search);
        const urlCategoryId = params.get("categoryId");
        if (urlCategoryId) {
            setCategoryId(urlCategoryId);
            setIsCategoryLocked(true);
        }
    }, []);

    const fetchCategories = async () => {
        try {
            const response = await fetch("/api/forums/categories");
            if (response.ok) {
                const data = await response.json();
                setCategories(data.categories || []);
            }
        } catch (error) {
            console.error("Error fetching categories:", error);
        }
    };

    const handleAddTag = () => {
        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
            setTags([...tags, tagInput.trim()]);
            setTagInput("");
        }
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter((tag) => tag !== tagToRemove));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const errors: Record<string, string> = {};
        if (!categoryId) errors.categoryId = 'Please select a category';
        if (!title.trim()) errors.title = 'Title is required';
        else if (title.trim().length < 5) errors.title = 'Title must be at least 5 characters';
        if (!content.trim()) errors.content = 'Content is required';
        else if (content.trim().length < 10) errors.content = 'Content must be at least 10 characters';

        if (Object.keys(errors).length > 0) {
            setFormErrors(errors);
            return;
        }
        setFormErrors({});

        setIsSubmitting(true);
        try {
            const response = await fetch("/api/forums/threads", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "user-id": localStorage.getItem("userId") || "",
                },
                body: JSON.stringify({
                    categoryId,
                    title,
                    content,
                    threadType,
                    tags,
                }),
            });

            if (response.ok) {
                const data = await response.json();
                toast({
                    title: "Thread created",
                    description: "Your thread has been posted successfully",
                });
                setLocation(`/forums/thread/${data.thread.id}`);
            } else {
                throw new Error("Failed to create thread");
            }
        } catch (error) {
            console.error("Error creating thread:", error);
            toast({
                title: "Error",
                description: "Failed to create thread. Please try again.",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!user) {
        return (
            <AppLayout currentPage="forums">
                <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 flex items-center justify-center">
                    <Card className="max-w-md">
                        <CardContent className="p-6 text-center">
                            <p className="text-gray-600 mb-4">Please login to create a thread</p>
                            <Button onClick={() => setLocation("/login")}>Login</Button>
                        </CardContent>
                    </Card>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout currentPage="forums">
            <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
                <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
                    <Button
                        variant="ghost"
                        onClick={() => setLocation("/forums")}
                        className="mb-3 sm:mb-4 min-h-[44px]"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">Back to Forums</span>
                        <span className="sm:hidden">Back</span>
                    </Button>

                    <Card>
                        <CardHeader className="p-4 sm:p-6">
                            <CardTitle className="text-lg sm:text-xl lg:text-2xl">Create New Thread</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-6">
                            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                                {/* Category Selection */}
                                <div>
                                    <Label htmlFor="category">Category *</Label>
                                    {isCategoryLocked ? (
                                        <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-muted px-3 py-2 text-sm ring-offset-background cursor-not-allowed opacity-100 text-muted-foreground mt-2">
                                            <span className="flex items-center gap-2">
                                                {categories.find(c => c.id === categoryId) ? (
                                                    <>
                                                        <span>{categories.find(c => c.id === categoryId)?.icon}</span>
                                                        <span>{categories.find(c => c.id === categoryId)?.name}</span>
                                                    </>
                                                ) : "Loading category..."}
                                            </span>
                                            <Lock className="h-4 w-4 opacity-50" />
                                        </div>
                                    ) : (
                                        <Select
                                            value={categoryId}
                                            onValueChange={(v) => { setCategoryId(v); setFormErrors(p => ({ ...p, categoryId: '' })); }}
                                        >
                                            <SelectTrigger className={`mt-2 ${formErrors.categoryId ? 'border-red-500 focus:ring-red-500' : ''}`}>
                                                <SelectValue placeholder="Select a category" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {categories.map((category) => (
                                                    <SelectItem key={category.id} value={category.id}>
                                                        <span className="flex items-center gap-2">
                                                            <span>{category.icon}</span>
                                                            <span>{category.name}</span>
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    {formErrors.categoryId && <p className="text-xs text-red-600 flex items-center gap-1 mt-1">⚠ {formErrors.categoryId}</p>}
                                    {isCategoryLocked && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                            Category selection is locked because you started this thread from a specific forum page.
                                        </p>
                                    )}
                                </div>

                                {/* Thread Type */}
                                <div>
                                    <Label htmlFor="type">Thread Type</Label>
                                    <Select value={threadType} onValueChange={setThreadType}>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="discussion">💬 Discussion</SelectItem>
                                            <SelectItem value="question">❓ Question</SelectItem>
                                            <SelectItem value="announcement">📢 Announcement</SelectItem>
                                            <SelectItem value="job_opportunity">💼 Job Opportunity</SelectItem>
                                            <SelectItem value="event">📅 Event</SelectItem>
                                            <SelectItem value="mentorship">🎓 Mentorship</SelectItem>
                                            <SelectItem value="resource">📚 Resource</SelectItem>
                                            <SelectItem value="poll">📊 Poll</SelectItem>
                                            <SelectItem value="success_story">🏆 Success Story</SelectItem>
                                            <SelectItem value="collaboration">💡 Collaboration</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Title */}
                                <div>
                                    <Label htmlFor="title" className="text-sm sm:text-base">Title *</Label>
                                    <Input
                                        id="title"
                                        value={title}
                                        onChange={(e) => { setTitle(e.target.value); if (formErrors.title) setFormErrors(p => ({ ...p, title: '' })); }}
                                        placeholder="Enter a descriptive title..."
                                        className={`text-base sm:text-lg min-h-[44px] ${formErrors.title ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                        maxLength={200}
                                    />
                                    <div className="flex items-center justify-between mt-1">
                                        {formErrors.title
                                            ? <p className="text-xs text-red-600 flex items-center gap-1">⚠ {formErrors.title}</p>
                                            : <span />}
                                        <p className="text-xs sm:text-sm text-gray-500">{title.length}/200</p>
                                    </div>
                                </div>

                                {/* Content */}
                                <div>
                                    <Label htmlFor="content" className="text-sm sm:text-base">Content *</Label>
                                    <textarea
                                        id="content"
                                        value={content}
                                        onChange={(e) => { setContent(e.target.value); if (formErrors.content) setFormErrors(p => ({ ...p, content: '' })); }}
                                        placeholder="Write your thread content here..."
                                        className={`w-full min-h-[200px] sm:min-h-[300px] p-3 border rounded-lg focus:outline-none focus:ring-2 resize-none text-sm sm:text-base ${formErrors.content ? 'border-red-500 focus:ring-red-500' : 'border-gray-200 focus:ring-[#008060]'}`}
                                    />
                                    {formErrors.content
                                        ? <p className="text-xs text-red-600 flex items-center gap-1 mt-1">⚠ {formErrors.content}</p>
                                        : <p className="text-xs sm:text-sm text-gray-500 mt-1">Be clear and descriptive. You can format your text with line breaks.</p>}
                                </div>

                                {/* Tags */}
                                <div>
                                    <Label htmlFor="tags">Tags (Optional)</Label>
                                    <div className="flex gap-2 mb-2">
                                        <Input
                                            id="tags"
                                            value={tagInput}
                                            onChange={(e) => setTagInput(e.target.value)}
                                            onKeyPress={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleAddTag();
                                                }
                                            }}
                                            placeholder="Add tags..."
                                        />
                                        <Button type="button" onClick={handleAddTag} variant="outline">
                                            Add
                                        </Button>
                                    </div>
                                    {tags.length > 0 && (
                                        <div className="flex flex-wrap gap-2">
                                            {tags.map((tag) => (
                                                <Badge key={tag} variant="secondary" className="gap-1">
                                                    #{tag}
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveTag(tag)}
                                                        className="ml-1 hover:text-red-600"
                                                    >
                                                        <X className="w-3 h-3" />
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Submit Buttons */}
                                <div className="flex gap-4 justify-end">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setLocation("/forums")}
                                    >
                                        Cancel
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={isSubmitting}
                                        variant="brand"
                                    >
                                        {isSubmitting ? "Creating..." : "Create Thread"}
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AppLayout>
    );
};
