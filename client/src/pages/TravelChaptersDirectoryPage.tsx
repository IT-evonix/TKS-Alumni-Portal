import React, { useState, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Globe, MapPin, List } from 'lucide-react';
import { TravelChapterSection } from './sections/TravelChapterSection';
import { TravelChaptersMap } from '@/components/TravelChaptersMap';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import maplibregl from 'maplibre-gl';

export default function TravelChaptersDirectoryPage() {
  const { user } = useAuth();
  const [mapBounds, setMapBounds] = useState<maplibregl.LngLatBounds | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<any | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'map'>('list');
  const [mapInteracted, setMapInteracted] = useState(false);
  const [resetTrigger, setResetTrigger] = useState(0);

  const handleResetMap = useCallback(() => {
    setMapInteracted(false);
    setSelectedChapter(null);
    setResetTrigger(prev => prev + 1);
  }, []);

  const handleMapInteract = useCallback(() => {
    setMapInteracted(true);
  }, []);

  const handleChapterClick = useCallback((chap: any | null) => {
    setSelectedChapter(chap);
    if (chap) {
      setMapInteracted(true);
    }
  }, []);

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
          <div className="flex flex-col-reverse lg:grid lg:grid-cols-12 gap-8 items-start relative">

            {/* Mobile View Toggle */}
            <div className="lg:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]">
              <button
                onClick={() => setMobileView(v => v === 'list' ? 'map' : 'list')}
                className="bg-green-700 text-white px-6 py-3 rounded-full font-bold shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex items-center gap-2 text-sm transition-transform active:scale-95"
              >
                {mobileView === 'list' ? <><MapPin className="w-4 h-4" /> Show Map</> : <><List className="w-4 h-4" /> Show List</>}
              </button>
            </div>

            {/* Left Column: Chapters Directory (8 cols on lg) */}
            <div className={`w-full lg:col-span-8 space-y-6 ${mobileView === 'map' ? 'hidden lg:block' : 'block'}`}>
              <TravelChapterSection
                hideHeader={false}
                chapters={chapters}
                isLoading={isLoading}
                mapBounds={mapBounds}
                selectedChapter={selectedChapter}
                onChapterClick={handleChapterClick}
                sidebarMode={false}
                mapInteracted={mapInteracted}
              />
            </div>

            {/* Right Column: Sticky Map Card Widget (4 cols on lg) */}
            <div className={`w-full lg:col-span-4 lg:sticky lg:top-24 space-y-0 ${mobileView === 'list' ? 'hidden lg:block' : 'block'}`}>
              {/* Card header — rounded top, no overflow issue */}
              <div className="bg-white border border-gray-200 border-b-0 rounded-t-2xl shadow-sm">
                <div className="p-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                      <Globe className="w-4 h-4 text-[#008060]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">Global Alumni Network</h3>
                      <p className="text-[10px] text-gray-500 font-medium">Explore chapters worldwide</p>
                    </div>
                  </div>
                  {mapInteracted && (
                    <button
                      onClick={handleResetMap}
                      className="text-xs text-[#008060] hover:text-[#006b51] font-bold bg-emerald-50 hover:bg-emerald-100/80 px-2.5 py-1.5 rounded-lg transition-all"
                    >
                      Reset View
                    </button>
                  )}
                </div>
              </div>

              {/* Map wrapper — overflow:visible so popup is NEVER clipped */}
              <div
                className="h-[calc(100vh-200px)] lg:h-[480px] w-full relative border border-gray-200 rounded-b-2xl shadow-sm"
                style={{ overflow: 'visible', background: '#f8fafc' }}
              >
                <TravelChaptersMap
                  chapters={chapters}
                  selectedChapter={selectedChapter}
                  onBoundsChange={setMapBounds}
                  onChapterClick={handleChapterClick}
                  currentUserId={user?.id}
                  onMapInteract={handleMapInteract}
                  resetTrigger={resetTrigger}
                />
              </div>
            </div>


          </div>
        </div>
      </div>
    </AppLayout>
  );
}
