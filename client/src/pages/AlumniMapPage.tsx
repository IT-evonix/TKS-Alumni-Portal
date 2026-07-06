import React, { useState } from 'react';
import AlumniHeatMap from '@/components/AlumniHeatMap';
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { MapPin, Users, Globe, Layers } from "lucide-react";

function AlumniMapPage() {
  const [mapStats, setMapStats] = useState<{
    totalAlumni: number;
    countries: number;
    continents: number;
  } | null>(null);

  return (
    <AppLayout currentPage="alumni-map">
      <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">

        {/* Subtitle + stat chips row */}
        <div className="flex flex-wrap items-center gap-3 px-4 sm:px-6 lg:px-8 mb-5">
          <p className="text-sm text-gray-500 flex items-center gap-1.5 mr-2">
            <MapPin className="w-4 h-4 text-[#008060] shrink-0" />
            Explore the global alumni network. Click locations for details.
          </p>

          {mapStats && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="flex flex-wrap gap-2"
            >
              {[
                { icon: <Users className="w-3.5 h-3.5 text-[#008060]" />, value: mapStats.totalAlumni, label: 'Alumni' },
                { icon: <Globe className="w-3.5 h-3.5 text-[#008060]" />, value: mapStats.countries, label: 'Countries' },
                { icon: <Layers className="w-3.5 h-3.5 text-[#008060]" />, value: mapStats.continents, label: 'Continents' },
              ].map(chip => (
                <div
                  key={chip.label}
                  className="flex items-center gap-1.5 bg-[#008060]/[0.06] border border-[#008060]/20 rounded-full px-3 py-1"
                >
                  {chip.icon}
                  <span className="text-xs font-bold text-gray-800 tabular-nums">{chip.value}</span>
                  <span className="text-xs text-gray-500">{chip.label}</span>
                </div>
              ))}
            </motion.div>
          )}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut", delay: 0.05 }}
          className="w-full px-4 sm:px-6 lg:px-8"
        >
          <AlumniHeatMap onDataLoad={setMapStats} />
        </motion.div>

        {/* How to explore tips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 px-4 sm:px-6 lg:px-8">
          {[
            {
              icon: <MapPin className="w-4 h-4 text-[#008060]" />,
              title: "Click to Zoom",
              desc: "Click any hotspot to drill down country → state → city."
            },
            {
              icon: <Globe className="w-4 h-4 text-[#008060]" />,
              title: "Sidebar Navigation",
              desc: "Use the directory to jump directly to a country, region, or city."
            },
            {
              icon: <Layers className="w-4 h-4 text-[#008060]" />,
              title: "Toggle Heatmap",
              desc: "Use the legend switch on the map to show or hide density."
            }
          ].map((tip) => (
            <div
              key={tip.title}
              className="flex items-start gap-2.5 bg-white border border-gray-100 shadow-sm rounded-xl p-3.5 hover:shadow-md transition-shadow duration-200"
            >
              <div className="w-7 h-7 rounded-lg bg-[#008060]/[0.08] flex items-center justify-center shrink-0 mt-0.5">
                {tip.icon}
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-800">{tip.title}</p>
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{tip.desc}</p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </AppLayout>
  );
}

export default AlumniMapPage;
