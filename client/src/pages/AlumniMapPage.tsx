import React from 'react';
import AlumniHeatMap from '@/components/AlumniHeatMap';
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageHeading } from "@/components/common/PageHeading";
import { MapPin } from "lucide-react";


function AlumniMapPage() {
  return (
    <AppLayout currentPage="alumni-map">
      <div className="w-full max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4 px-2">
          <div>
            <PageHeading firstWord="Alumni" secondWord="Map" />
            <p className="text-sm text-gray-500 mt-2 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#008060]" />
              Explore our global network. Click on locations to see alumni details.
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          className="w-full mb-12"
        >
          <AlumniHeatMap />
        </motion.div>

        <div className="mt-8">
          {/* Bottom padding or any other global network specific footer */}
        </div>
      </div>
    </AppLayout>
  );
}

export default AlumniMapPage;
