import { ArrowRight, Sparkles } from "lucide-react";
import React, { useRef } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { motion, useInView } from "framer-motion";

export const CallToActionSection = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const ref = useRef<HTMLElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="relative py-24 md:py-32 bg-gradient-to-b from-slate-50 via-indigo-50/40 to-slate-100 overflow-hidden">
      {/* Background decorations */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_30%_20%,rgba(99,102,241,0.08),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_60%_at_80%_80%,rgba(16,185,129,0.06),transparent)]" />

      {/* Subtle dot grid */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.3) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Floating decorative shapes */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 1.5, ease: "easeOut" }}
        className="absolute top-16 left-[10%] w-64 h-64 bg-indigo-200/20 rounded-full blur-3xl"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
        className="absolute bottom-10 right-[8%] w-48 h-48 bg-emerald-200/25 rounded-full blur-3xl"
      />

      <div className="relative max-w-4xl mx-auto px-6">
        {/* Main CTA card */}
        <motion.div
          initial={{ opacity: 0, y: 36 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative bg-white rounded-3xl border border-gray-200/80 shadow-xl shadow-gray-200/50 overflow-hidden"
        >
          {/* Top gradient accent line */}
          <div className="h-1 w-full bg-gradient-to-r from-emerald-400 via-indigo-500 to-violet-500" />

          {/* Inner glow effects */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-50/60 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
          <div className="absolute bottom-0 left-0 w-60 h-60 bg-emerald-50/50 rounded-full blur-3xl translate-y-1/3 -translate-x-1/4" />

          <div className="relative px-8 py-14 md:px-16 md:py-20 lg:px-20 lg:py-24">
            <div className="max-w-2xl mx-auto text-center">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, ease: "easeOut", delay: 0.15 }}
                className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 rounded-full border border-indigo-100 mb-8"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Join the community</span>
              </motion.div>

              {/* Heading */}
              <motion.h2
                initial={{ opacity: 0, y: 24 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
                className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-5 tracking-tight leading-[1.15]"
              >
                Be part of The Kalyani{" "}
                <span className="bg-gradient-to-r from-emerald-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                  School legacy
                </span>
              </motion.h2>

              {/* Description */}
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.7, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }}
                className="text-base md:text-lg text-gray-500 mb-10 max-w-lg mx-auto leading-relaxed"
              >
                Stay connected, network, and make an impact with fellow alumni around the world.
              </motion.p>

              {/* Buttons */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
              >
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    onClick={() => setLocation("/signup")}
                    className="bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm sm:text-base px-7 sm:px-8 py-3 h-auto rounded-xl shadow-lg shadow-gray-900/15 hover:shadow-gray-900/25 transition-all duration-300 inline-flex items-center gap-2.5"
                  >
                    Join the Alumni Portal
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </motion.div>
                <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                  <Button
                    variant="outline"
                    onClick={() => setLocation("/login")}
                    className="bg-white border-gray-300 text-gray-700 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-400 font-medium text-sm sm:text-base px-7 sm:px-8 py-3 h-auto rounded-xl transition-all duration-300"
                  >
                    Sign In
                  </Button>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Trust indicators below the card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.5 }}
          className="flex flex-wrap items-center justify-center gap-6 mt-8 text-sm text-gray-400"
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Free to join</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
            <span>500+ alumni connected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
            <span>Verified community</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};
