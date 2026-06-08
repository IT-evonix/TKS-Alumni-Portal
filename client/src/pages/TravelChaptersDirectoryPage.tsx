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
      {/* 
        Container for the page
      */}
      <div className="w-full max-w-[1600px] mx-auto flex flex-col bg-white min-h-[calc(100vh-64px)]">
        
        {/* Split View Container */}
        <div className="flex flex-col lg:flex-row w-full h-auto lg:h-[calc(100vh-64px)] lg:overflow-hidden">
          
          {/* Left Side: Directory (Cards & Search) */}
          <div className="w-full lg:w-[45%] xl:w-[40%] flex-1 h-auto lg:h-full lg:overflow-y-auto bg-white lg:border-r border-gray-200 shadow-[2px_0_10px_-4px_rgba(0,0,0,0.1)] z-40 relative custom-scrollbar order-last lg:order-none">
            <div className="pb-20">
              <TravelChapterSection 
                hideHeader 
                chapters={chapters} 
                isLoading={isLoading} 
                mapBounds={mapBounds} 
                selectedChapter={selectedChapter}
                onChapterClick={setSelectedChapter}
                sidebarMode={true}
              />
            </div>
          </div>

          {/* Right Side: Interactive Map */}
          <div className="w-full lg:w-[55%] xl:w-[60%] h-[40vh] sm:h-[45vh] lg:h-full relative z-50 lg:z-10 bg-slate-100 order-first lg:order-none">
            <TravelChaptersMap chapters={chapters} onBoundsChange={setMapBounds} onChapterClick={setSelectedChapter} />
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
