import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeading } from '@/components/common/PageHeading';
import { Globe } from 'lucide-react';
import { TravelChapterSection } from './sections/TravelChapterSection';
import { TravelChaptersMap } from '@/components/TravelChaptersMap';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import maplibregl from 'maplibre-gl';

export default function TravelChaptersDirectoryPage() {
  const [mapBounds, setMapBounds] = useState<maplibregl.LngLatBounds | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<any | null>(null);

  const { data: chapters = [], isLoading } = useQuery({
    queryKey: ['travel-chapters'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/travel-chapters');
      if (!res.ok) throw new Error("Failed to fetch chapters");
      return res.json();
    }
  });

  return (
    <AppLayout currentPage="travel-chapters">
      <div className="w-full min-h-screen bg-gray-50/50 pb-12">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          
          {/* Layout Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Left Column: Chapters Directory (8 cols on lg) */}
            <div className="lg:col-span-8 space-y-6">
              <TravelChapterSection 
                hideHeader={false}
                chapters={chapters} 
                isLoading={isLoading} 
                mapBounds={mapBounds} 
                selectedChapter={selectedChapter}
                onChapterClick={setSelectedChapter}
                sidebarMode={false}
              />
            </div>

            {/* Right Column: Sticky Map Card Widget (4 cols on lg) */}
            <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <Globe className="w-4.5 h-4.5 text-[#008060]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">Global Alumni Network</h3>
                      <p className="text-[10px] text-gray-500 font-medium">Explore chapters worldwide</p>
                    </div>
                  </div>
                </div>
                
                {/* Map Wrapper with fixed height */}
                <div className="h-[500px] w-full relative bg-slate-50">
                  <TravelChaptersMap 
                    chapters={chapters} 
                    selectedChapter={selectedChapter}
                    onBoundsChange={setMapBounds} 
                    onChapterClick={setSelectedChapter} 
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}
