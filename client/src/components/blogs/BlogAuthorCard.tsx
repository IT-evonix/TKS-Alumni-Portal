import React from "react";
import { useLocation } from "wouter";
import { ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

interface BlogAuthorCardProps {
  author: {
    id?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
    profile_picture?: string;
    bio?: string;
    current_role?: string;
    company?: string;
  };
}

export function BlogAuthorCard({ author }: BlogAuthorCardProps) {
  const [, setLocation] = useLocation();

  const fullName = `${author.first_name || ""} ${author.last_name || ""}`.trim() || author.username || "Unknown";
  const initials = fullName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  const roleText = [author.current_role, author.company].filter(Boolean).join(" at ");

  return (
    <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100">
      <Avatar className="h-12 w-12 flex-shrink-0">
        <AvatarImage src={author.profile_picture} />
        <AvatarFallback className="bg-[#008060]/10 text-[#008060] font-semibold">{initials}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-semibold text-gray-900 text-sm">{fullName}</p>
            {roleText && <p className="text-xs text-gray-500 mt-0.5">{roleText}</p>}
          </div>
          {author.id && (
            <Button
              variant="ghost"
              size="sm"
              className="text-[#008060] hover:bg-[#008060]/10 text-xs h-7 flex-shrink-0"
              onClick={() => setLocation(`/profile/${author.id}`)}
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Profile
            </Button>
          )}
        </div>
        {author.bio && (
          <p className="text-xs text-gray-500 mt-1.5 line-clamp-2">{author.bio}</p>
        )}
      </div>
    </div>
  );
}
