import React from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BlogFilterBarProps {
  categories: any[];
  search: string;
  selectedCategory: string;
  selectedTag: string;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onTagChange: (tag: string) => void;
  popularTags?: string[];
}

export function BlogFilterBar({
  categories,
  search,
  selectedCategory,
  selectedTag,
  onSearchChange,
  onCategoryChange,
  onTagChange,
  popularTags = [],
}: BlogFilterBarProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search blogs..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
          {search && (
            <button
              onClick={() => onSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Category filter */}
        <Select value={selectedCategory || "all"} onValueChange={(v) => onCategoryChange(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.slug}>
                {cat.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Clear filters */}
        {(search || selectedCategory || selectedTag) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { onSearchChange(""); onCategoryChange(""); onTagChange(""); }}
            className="text-gray-500"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Popular tags */}
      {popularTags.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400 font-medium">Tags:</span>
          {popularTags.map((tag) => (
            <Badge
              key={tag}
              variant={selectedTag === tag ? "default" : "outline"}
              className={`cursor-pointer text-xs transition-colors ${
                selectedTag === tag
                  ? "bg-[#008060] text-white border-[#008060]"
                  : "hover:bg-[#008060]/10 hover:border-[#008060] hover:text-[#008060]"
              }`}
              onClick={() => onTagChange(selectedTag === tag ? "" : tag)}
            >
              #{tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
