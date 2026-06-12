import React from "react";
import { useLocation } from "wouter";
import { Mic2, Eye, ArrowRight, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FeedPodcast } from "@/types/feed";

interface FeedPodcastCardProps {
  podcast: FeedPodcast;
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function FeedPodcastCard({ podcast }: FeedPodcastCardProps) {
  const [, setLocation] = useLocation();

  const displayDate = podcast.published_at || podcast.created_at;
  const navigate = () => setLocation(`/podcasts/${podcast.slug}`);

  return (
    <Card
      className="group cursor-pointer hover:shadow-md transition-all duration-200"
      style={{ border: "1px solid var(--border-subtle)", boxShadow: "var(--shadow-card)" }}
      onClick={navigate}
    >
      <CardContent className="p-4">
        <div className="flex gap-4 items-start">
          {/* Icon block */}
          <div className="flex-shrink-0 w-[72px] h-[72px] rounded-2xl bg-purple-100 flex items-center justify-center">
            <Mic2 className="w-8 h-8 text-purple-500" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Badges row */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className="bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold hover:bg-purple-50">
                Podcast
              </Badge>
              {podcast.episode_number != null && (
                <span className="text-xs text-gray-400 font-medium">Ep. {podcast.episode_number}</span>
              )}
            </div>

            {/* Title */}
            <h3 className="font-semibold text-gray-900 text-base leading-snug line-clamp-2 group-hover:text-purple-700 transition-colors">
              {podcast.title}
            </h3>

            {/* Description */}
            {podcast.description && (
              <p className="text-sm text-gray-500 line-clamp-2">{podcast.description}</p>
            )}

            {/* Tags */}
            {podcast.tags && podcast.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {podcast.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="text-xs bg-purple-50 text-purple-600 px-2 py-0.5 rounded-full">
                    #{tag}
                  </span>
                ))}
                {podcast.tags.length > 3 && (
                  <span className="text-xs text-gray-400">+{podcast.tags.length - 3} more</span>
                )}
              </div>
            )}

            {/* Footer */}
            <div
              className="flex items-center justify-between pt-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(displayDate)}
                </span>
                {(podcast.views_count ?? 0) > 0 && (
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {podcast.views_count}
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 border-purple-300 text-purple-700 hover:bg-purple-600 hover:text-white hover:border-purple-600"
                onClick={(e) => { e.stopPropagation(); navigate(); }}
              >
                View Episode <ArrowRight className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
