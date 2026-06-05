import React, { useRef } from "react";
import { Users, Search, Bell } from "lucide-react";
import { motion, useInView } from "framer-motion";

export const WhyJoinSection = (): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-60px" });

  const benefits = [
    {
      title: "Connect",
      description: "Find classmates and faculty across the globe. Build relationships that extend far beyond campus walls.",
      icon: Users,
      illustration: "/landing-assets/connect_illustration.png",
      accent: "from-emerald-500 to-teal-500",
      iconBg: "bg-emerald-100 text-emerald-600",
      number: "01",
    },
    {
      title: "Discover",
      description: "Unlock opportunities for mentorship, networking, and collaboration with alumni in every field.",
      icon: Search,
      illustration: "/landing-assets/discover_illustration.png",
      accent: "from-indigo-500 to-violet-500",
      iconBg: "bg-indigo-100 text-indigo-600",
      number: "02",
    },
    {
      title: "Stay Updated",
      description: "Never miss reunions, webinars, and school events. Stay in the loop with what matters most.",
      icon: Bell,
      illustration: "/landing-assets/stay_updated_illustration.png",
      accent: "from-amber-500 to-orange-500",
      iconBg: "bg-amber-100 text-amber-600",
      number: "03",
    }
  ];

  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.15 } },
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 28 },
    visible: {
      opacity: 1, y: 0,
      transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] },
    },
  };

  return (
    <motion.div
      ref={containerRef}
      variants={containerVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto"
    >
      {benefits.map((benefit, index) => {
        const Icon = benefit.icon;
        return (
          <motion.div
            key={index}
            variants={cardVariants}
            whileHover={{
              y: -8,
              transition: { duration: 0.25, ease: "easeOut" },
            }}
            className="group relative bg-white rounded-2xl border border-gray-200/80 overflow-hidden shadow-sm hover:shadow-xl transition-shadow duration-300 cursor-default"
          >
            {/* Top accent bar */}
            <div className={`h-1 w-full bg-gradient-to-r ${benefit.accent}`} />

            <div className="p-6 lg:p-8">
              {/* Header: icon + number */}
              <div className="flex items-center justify-between mb-5">
                <div className={`w-12 h-12 rounded-xl ${benefit.iconBg} flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-3xl font-bold text-gray-100 group-hover:text-gray-200 transition-colors duration-300">
                  {benefit.number}
                </span>
              </div>

              {/* Illustration */}
              <div className="w-full h-[150px] flex items-center justify-center bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl mb-5 overflow-hidden border border-gray-100">
                <img
                  src={benefit.illustration}
                  alt={benefit.title}
                  className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
              </div>

              {/* Content */}
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {benefit.title}
              </h3>
              <p className="text-gray-500 leading-relaxed text-sm">
                {benefit.description}
              </p>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
};
