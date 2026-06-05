import React, { useRef, useState } from "react";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { Users, Globe } from "lucide-react";

const locations = [
  {
    flag: "🇮🇳", city: "Pune", country: "India", count: "1,200+",
    accent: "from-orange-500 to-amber-500", iconBg: "bg-orange-100 text-orange-600",
    x: 67, y: 43,
  },
  {
    flag: "🇺🇸", city: "New York", country: "USA", count: "320+",
    accent: "from-blue-500 to-indigo-500", iconBg: "bg-blue-100 text-blue-600",
    x: 21, y: 30,
  },
  {
    flag: "🇬🇧", city: "London", country: "UK", count: "180+",
    accent: "from-purple-500 to-violet-500", iconBg: "bg-purple-100 text-purple-600",
    x: 46, y: 20,
  },
  {
    flag: "🇦🇺", city: "Sydney", country: "Australia", count: "95+",
    accent: "from-yellow-500 to-orange-500", iconBg: "bg-yellow-100 text-yellow-600",
    x: 83, y: 72,
  },
  {
    flag: "🇦🇪", city: "Dubai", country: "UAE", count: "140+",
    accent: "from-emerald-500 to-teal-500", iconBg: "bg-emerald-100 text-emerald-600",
    x: 60, y: 40,
  },
  {
    flag: "🇸🇬", city: "Singapore", country: "Singapore", count: "75+",
    accent: "from-red-500 to-rose-500", iconBg: "bg-red-100 text-red-600",
    x: 76, y: 54,
  },
  {
    flag: "🇨🇦", city: "Toronto", country: "Canada", count: "60+",
    accent: "from-rose-500 to-pink-500", iconBg: "bg-rose-100 text-rose-600",
    x: 19, y: 23,
  },
  {
    flag: "🇩🇪", city: "Berlin", country: "Germany", count: "45+",
    accent: "from-slate-500 to-gray-600", iconBg: "bg-slate-100 text-slate-600",
    x: 50, y: 19,
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.25, 0.1, 0.25, 1] } },
};

export const TravelChapterSection = (): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-60px" });
  const [hoveredPin, setHoveredPin] = useState<number | null>(null);

  return (
    <div ref={containerRef}>
      {/* ── World Map ───────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={isInView ? { opacity: 1, scale: 1 } : {}}
        transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1] }}
        className="relative w-full rounded-2xl overflow-hidden border border-gray-200/80 bg-gradient-to-b from-slate-50 to-white shadow-sm mb-10"
        style={{ height: "340px" }}
      >
        {/* Grid pattern */}
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(148,163,184,0.4) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Latitude / longitude lines */}
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          {/* Equator */}
          <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(148,163,184,0.25)" strokeWidth="1" strokeDasharray="4 6" />
          {/* Tropics */}
          <line x1="0" y1="37%" x2="100%" y2="37%" stroke="rgba(148,163,184,0.15)" strokeWidth="1" strokeDasharray="3 8" />
          <line x1="0" y1="63%" x2="100%" y2="63%" stroke="rgba(148,163,184,0.15)" strokeWidth="1" strokeDasharray="3 8" />
          {/* Prime meridian */}
          <line x1="50%" y1="0" x2="50%" y2="100%" stroke="rgba(148,163,184,0.2)" strokeWidth="1" strokeDasharray="4 6" />
          {/* Vertical thirds */}
          <line x1="25%" y1="0" x2="25%" y2="100%" stroke="rgba(148,163,184,0.1)" strokeWidth="1" strokeDasharray="3 8" />
          <line x1="75%" y1="0" x2="75%" y2="100%" stroke="rgba(148,163,184,0.1)" strokeWidth="1" strokeDasharray="3 8" />
        </svg>

        {/* Continent silhouettes (simplified decorative blobs) */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1000 340" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
          {/* North America */}
          <ellipse cx="185" cy="130" rx="110" ry="70" fill="rgba(226,232,240,0.6)" />
          <ellipse cx="200" cy="195" rx="60" ry="45" fill="rgba(226,232,240,0.55)" />
          {/* South America */}
          <ellipse cx="240" cy="260" rx="55" ry="70" fill="rgba(226,232,240,0.55)" />
          {/* Europe */}
          <ellipse cx="490" cy="110" rx="70" ry="50" fill="rgba(226,232,240,0.6)" />
          {/* Africa */}
          <ellipse cx="500" cy="220" rx="75" ry="90" fill="rgba(226,232,240,0.55)" />
          {/* Asia */}
          <ellipse cx="690" cy="120" rx="170" ry="80" fill="rgba(226,232,240,0.6)" />
          {/* India sub-peninsula */}
          <ellipse cx="660" cy="190" rx="35" ry="50" fill="rgba(226,232,240,0.5)" />
          {/* Southeast Asia */}
          <ellipse cx="760" cy="195" rx="40" ry="35" fill="rgba(226,232,240,0.5)" />
          {/* Australia */}
          <ellipse cx="830" cy="255" rx="75" ry="55" fill="rgba(226,232,240,0.55)" />
        </svg>

        {/* Glowing orbs behind prominent pins */}
        <div className="absolute pointer-events-none" style={{ left: "67%", top: "43%", transform: "translate(-50%,-50%)" }}>
          <div className="w-20 h-20 rounded-full bg-primary-green-1/10 blur-xl" />
        </div>

        {/* Alumni pins */}
        {locations.map((loc, i) => (
          <div
            key={i}
            className="absolute"
            style={{ left: `${loc.x}%`, top: `${loc.y}%`, transform: "translate(-50%, -100%)" }}
            onMouseEnter={() => setHoveredPin(i)}
            onMouseLeave={() => setHoveredPin(null)}
          >
            {/* Pulse ring */}
            <motion.div
              className="absolute inset-0 rounded-full bg-primary-green-1/30"
              animate={{ scale: [1, 2.2, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ repeat: Infinity, duration: 2.4, delay: i * 0.28, ease: "easeInOut" }}
              style={{ width: 16, height: 16, top: 4, left: 4 }}
            />

            {/* Pin dot */}
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={isInView ? { scale: 1, opacity: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.07, type: "spring", stiffness: 260, damping: 18 }}
              className="relative cursor-pointer"
            >
              <div className="w-6 h-6 rounded-full bg-primary-green-1 border-2 border-white shadow-lg shadow-primary-green-1/40 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-white" />
              </div>
            </motion.div>

            {/* Tooltip */}
            <AnimatePresence>
              {hoveredPin === i && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.92 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.92 }}
                  transition={{ duration: 0.18 }}
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 pointer-events-none"
                >
                  <div className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-lg shadow-xl whitespace-nowrap">
                    <span className="mr-1">{loc.flag}</span>
                    {loc.city} · {loc.count} alumni
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {/* Bottom stat badge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="absolute bottom-4 right-4 flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-xl px-4 py-2 shadow-sm"
        >
          <Globe className="w-3.5 h-3.5 text-primary-green-1" />
          <span className="text-xs font-semibold text-gray-700">50+ Countries</span>
        </motion.div>
      </motion.div>

      {/* ── Location Cards ──────────────────────────────────────────────────── */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate={isInView ? "visible" : "hidden"}
        className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3"
      >
        {locations.map((loc, i) => (
          <motion.div
            key={i}
            variants={cardVariants}
            whileHover={{ y: -6, scale: 1.03, transition: { duration: 0.2, ease: "easeOut" } }}
            className="group relative bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm hover:shadow-lg transition-shadow duration-300 cursor-default"
          >
            {/* Top accent bar */}
            <div className={`h-1 w-full bg-gradient-to-r ${loc.accent}`} />

            <div className="p-4 flex flex-col items-center text-center gap-2">
              <span className="text-3xl leading-none">{loc.flag}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900 leading-tight">{loc.city}</p>
                <p className="text-xs text-gray-400">{loc.country}</p>
              </div>
              <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-100 rounded-full px-2 py-0.5">
                <Users className="w-2.5 h-2.5 text-emerald-600" />
                <span className="text-[10px] font-semibold text-emerald-700">{loc.count}</span>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};
