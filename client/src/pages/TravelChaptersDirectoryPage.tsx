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
      <div className="w-full h-[calc(100vh-64px)] overflow-hidden bg-white text-gray-900 relative">
        
        {/* Split View Container */}
        <div className="flex flex-col lg:flex-row w-full h-full relative">
          
          {/* Left Side: Directory (Cards & Search) */}
          <div className="w-full lg:w-[400px] xl:w-[450px] flex-none h-auto lg:h-full lg:overflow-y-auto bg-gray-50 border-r border-gray-200 shadow-lg z-40 relative custom-scrollbar order-last lg:order-none lg:absolute lg:left-0 lg:top-0 lg:bottom-0">
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
          <div className="w-full h-[50vh] lg:h-full lg:absolute lg:inset-0 z-10 bg-slate-100 order-first lg:order-none">
            <TravelChaptersMap chapters={chapters} onBoundsChange={setMapBounds} onChapterClick={setSelectedChapter} />
          </div>

        </div>
      </div>
    </AppLayout>
  );
}
