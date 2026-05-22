import React from 'react';
import AlumniHeatMap from '@/components/AlumniHeatMap';
import { LandingNavbar } from "@/components/common/LandingNavbar";
import { LandingFooter } from "@/components/common/LandingFooter";
import { motion } from "framer-motion";
import { Globe, Users, TrendingUp } from "lucide-react";

const SectionHeader = ({
  label,
  title,
  description,
}: {
  label: string;
  title: React.ReactNode;
  description: string;
}) => (
  <div className="mb-14 text-center max-w-3xl mx-auto">
    <motion.span
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="inline-block text-xs font-semibold text-primary-green-1 uppercase tracking-widest mb-3"
    >
      {label}
    </motion.span>
    <motion.h2
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
      className="text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-6 tracking-tight leading-[1.15]"
    >
      {title}
    </motion.h2>
    <motion.p
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
      className="text-lg text-gray-500 leading-relaxed"
    >
      {description}
    </motion.p>
  </div>
);

function AlumniMapPage() {
  return (
    <div className="min-h-screen bg-slate-50 overflow-x-hidden pt-[100px]">
      <LandingNavbar />

      {/* Decorative Background Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(99,102,241,0.07),transparent)]" />
        <motion.div
          animate={{ y: [0, 20, 0], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 right-[10%] w-[500px] h-[500px] bg-primary-green-1/10 rounded-full blur-[100px]"
        />
        <motion.div
          animate={{ y: [0, -30, 0], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-[40%] -left-24 w-[400px] h-[400px] bg-primary-green-2/10 rounded-full blur-[80px]"
        />
      </div>

      <div className="relative z-10 container mx-auto px-6 py-12 md:py-16">
        <SectionHeader
          label="Global Network"
          title={
            <>
              Alumni{" "}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                Distribution
              </span>{" "}
              Map
            </>
          }
          description="Connecting generations of The Kalyani School alumni. Explore our growing community across cities, states, and countries worldwide."
        />

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }}
          className="max-w-7xl mx-auto relative z-10"
        >
          <div className="bg-white rounded-[2.5rem] p-4 md:p-8 shadow-2xl shadow-gray-200/50 border border-gray-100">
            <AlumniHeatMap />
          </div>
        </motion.div>
      </div>

      <LandingFooter />
    </div>
  );
}

export default AlumniMapPage;
