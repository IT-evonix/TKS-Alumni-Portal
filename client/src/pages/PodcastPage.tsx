import React from "react";
import { Mic2, Headphones, Play } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const PLACEHOLDER_EPISODES = [
  {
    id: 1,
    title: "Life After TKS: Finding Your Path",
    guest: "Priya Sharma, Batch of 2015",
    duration: "42 min",
    tag: "Career",
  },
  {
    id: 2,
    title: "Building a Startup from Scratch",
    guest: "Rohan Mehta, Batch of 2012",
    duration: "55 min",
    tag: "Entrepreneurship",
  },
  {
    id: 3,
    title: "Working Abroad: Lessons from the Field",
    guest: "Anika Roy, Batch of 2018",
    duration: "38 min",
    tag: "Global",
  },
];

export function PodcastPage() {
  return (
    <AppLayout currentPage="podcast">
      <div className="max-w-3xl mx-auto py-10 px-4 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#e6f5f0] flex items-center justify-center flex-shrink-0">
            <Mic2 className="w-7 h-7 text-[#008060]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">TKS Alumni Podcast</h1>
            <p className="text-sm text-gray-500 mt-0.5">Stories, insights, and inspiration from the TKS alumni community.</p>
          </div>
        </div>

        {/* Coming Soon Banner */}
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm font-medium">
          <Headphones className="w-5 h-5 flex-shrink-0 text-amber-500" />
          Full episodes and streaming are coming soon. Below is a preview of what to expect.
        </div>

        {/* Episode Cards */}
        <div className="space-y-3">
          {PLACEHOLDER_EPISODES.map((ep) => (
            <Card key={ep.id} className="border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#e6f5f0] flex items-center justify-center flex-shrink-0">
                  <Play className="w-4 h-4 text-[#008060] ml-0.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{ep.title}</p>
                  <p className="text-xs text-gray-500 truncate">{ep.guest}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Badge variant="secondary" className="text-[10px]">{ep.tag}</Badge>
                  <span className="text-xs text-gray-400">{ep.duration}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
