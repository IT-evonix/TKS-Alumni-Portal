import React, { useCallback, useEffect, useRef, useState } from "react";
import { Users, Calendar, MessageCircle, Mail } from "lucide-react";
import { motion, AnimatePresence, useInView } from "framer-motion";

export const WhatYouWillFindSection = (): JSX.Element => {
  const [activeFeature, setActiveFeature] = useState(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-60px" });
  const isPaused = useRef(false);
  const pauseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [timerKey, setTimerKey] = useState(0);

  const features = [
    {
      title: "Alumni Directory",
      description: "Find and connect with classmates, seniors, juniors, and faculty across batches. Search by batch, location, industry, or interests.",
      mockup: "/landing-assets/alumni_directory_mockup.png",
      icon: Users,
      accentBg: "bg-violet-100",
      accentText: "text-violet-600",
      dotColor: "bg-violet-500",
    },
    {
      title: "Events & Webinars",
      description: "Never miss an opportunity to be part of the TKS family again. Event calendar with upcoming reunions, webinars, and networking sessions.",
      mockup: "/landing-assets/events_calendar_mockup.png",
      icon: Calendar,
      accentBg: "bg-amber-100",
      accentText: "text-amber-600",
      dotColor: "bg-amber-500",
    },
    {
      title: "Networking & Forums",
      description: "A space to grow professionally and personally, together. Discussion forums around Careers, Mentorship, Higher Studies and more.",
      mockup: "/landing-assets/forums_mockup.png",
      icon: MessageCircle,
      accentBg: "bg-blue-100",
      accentText: "text-blue-600",
      dotColor: "bg-blue-500",
    },
    {
      title: "Messaging",
      description: "Reconnect privately and meaningfully with your peers. Asynchronous messaging within the portal for alumni-to-alumni conversations.",
      mockup: "/landing-assets/messaging_mockup.png",
      icon: Mail,
      accentBg: "bg-rose-100",
      accentText: "text-rose-600",
      dotColor: "bg-rose-500",
    }
  ];

  const featuresLength = features.length;

  // Auto-rotate every 5s, pauses on user click for 12s
  useEffect(() => {
    if (!isInView) return;
    const interval = setInterval(() => {
      if (!isPaused.current) {
        setActiveFeature((prev) => {
          const next = (prev + 1) % featuresLength;
          setTimerKey((k) => k + 1);
          return next;
        });
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [featuresLength, isInView]);

  const handleFeatureClick = useCallback((index: number) => {
    setActiveFeature(index);
    setTimerKey((k) => k + 1);
    isPaused.current = true;
    if (pauseTimer.current) clearTimeout(pauseTimer.current);
    pauseTimer.current = setTimeout(() => {
      isPaused.current = false;
    }, 12000);
  }, []);

  useEffect(() => {
    return () => {
      if (pauseTimer.current) clearTimeout(pauseTimer.current);
    };
  }, []);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5, staggerChildren: 0.08 } },
  };

  const itemVariant = {
    hidden: { opacity: 0, x: -16 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5, ease: "easeOut" } },
  };

  return (
    <motion.div
      ref={sectionRef}
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      className="max-w-7xl mx-auto"
    >
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
        {/* Left — Feature List */}
        <div className="space-y-1">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isActive = index === activeFeature;
            return (
              <motion.button
                key={index}
                variants={itemVariant}
                onClick={() => handleFeatureClick(index)}
                className={`w-full text-left px-5 py-4 rounded-2xl transition-all duration-300 border cursor-pointer group ${
                  isActive
                    ? 'bg-white border-gray-200 shadow-md'
                    : 'bg-transparent border-transparent hover:bg-white/60 hover:border-gray-100'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    isActive ? `${feature.accentBg} ${feature.accentText}` : 'bg-gray-100 text-gray-400 group-hover:bg-gray-200/70'
                  }`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-base font-semibold transition-colors duration-300 ${
                      isActive ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'
                    }`}>
                      {feature.title}
                    </h3>
                    <AnimatePresence initial={false}>
                      {isActive && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="overflow-hidden"
                        >
                          <p className="text-sm leading-relaxed text-gray-500 mt-1.5 pr-2">
                            {feature.description}
                          </p>
                          {/* Progress bar — shows auto-rotate timer */}
                          <div className="mt-3 h-[3px] w-full bg-gray-100 rounded-full overflow-hidden">
                            <motion.div
                              key={timerKey}
                              className={`h-full rounded-full ${feature.dotColor}`}
                              initial={{ width: "0%" }}
                              animate={{ width: "100%" }}
                              transition={{ duration: isPaused.current ? 12 : 5, ease: "linear" }}
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Right — Feature Image */}
        <motion.div variants={itemVariant} className="relative">
          {/* Background glow */}
          <div className="absolute -inset-6 bg-gradient-to-br from-indigo-50 via-white to-violet-50 rounded-3xl blur-sm opacity-60" />

          <div className="relative bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg aspect-square">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFeature}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                className="absolute inset-0"
              >
                <img
                  src={features[activeFeature].mockup}
                  alt={features[activeFeature].title}
                  loading="lazy"
                  className="w-full h-full object-cover object-top"
                />
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
