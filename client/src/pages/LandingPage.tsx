import React, { Suspense } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Loader2, MapPin, Phone, Mail, ArrowUp, ArrowRight, Facebook, Linkedin, Instagram, X, Globe, Sparkles } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Helmet } from "react-helmet-async";
import { motion, useInView, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { HEADER_NAV_LINKS, FOOTER_QUICK_LINKS, SOCIAL_LINKS, type NavLinkConfig } from "@/constants/landingLinks";

// Lazy load sections
const WhyJoinSection = React.lazy(() => import("./sections/WhyJoinSection").then(module => ({ default: module.WhyJoinSection })));
const WhatYouWillFindSection = React.lazy(() => import("./sections/WhatYouWillFindSection").then(module => ({ default: module.WhatYouWillFindSection })));
const UpcomingEventsSection = React.lazy(() => import("./sections/UpcomingEventsSection").then(module => ({ default: module.UpcomingEventsSection })));
const UpcomingJobsSection = React.lazy(() => import("./sections/UpcomingJobsSection").then(module => ({ default: module.UpcomingJobsSection })));
const CallToActionSection = React.lazy(() => import("./sections/CallToActionSection").then(module => ({ default: module.CallToActionSection })));
const CityChapterSection = React.lazy(() => import("./sections/TravelChapterSection").then(module => ({ default: module.TravelChapterSection })));
import { AlumniPrideVideo } from "@/components/common/AlumniPrideVideo";
import { LandingNavbar } from "@/components/common/LandingNavbar";

// ─── Reusable scroll-reveal wrapper ──────────────────────────────────────────
const RevealOnScroll = ({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 32 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
      transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// ─── Section header — supports center + left alignment ───────────────────────
const SectionHeader = ({
  label,
  title,
  description,
  align = "center",
}: {
  label: string;
  title: string;
  description: string;
  align?: "center" | "left";
}) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });
  const isCenter = align === "center";

  return (
    <div ref={ref} className={`mb-14 md:mb-16 ${isCenter ? "text-center" : "text-left max-w-2xl"}`}>
      <motion.span
        initial={{ opacity: 0, y: 12 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="inline-block text-xs font-semibold text-primary-green-1 uppercase tracking-widest mb-3"
      >
        {label}
      </motion.span>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
        className="text-3xl md:text-4xl lg:text-[2.75rem] font-bold text-gray-900 mb-4 tracking-tight leading-[1.15]"
      >
        {title}
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 16 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.6, ease: "easeOut", delay: 0.2 }}
        className={`text-lg text-gray-500 leading-relaxed ${isCenter ? "max-w-2xl mx-auto" : "max-w-xl"}`}
      >
        {description}
      </motion.p>
    </div>
  );
};

const SectionLoader = () => (
  <div className="w-full h-64 flex items-center justify-center">
    <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
  </div>
);

// ─── Main component ──────────────────────────────────────────────────────────
export const LandingPage = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const { user, adminUser } = useAuth();
  const [showScrollTop, setShowScrollTop] = React.useState(false);
  const heroRef = React.useRef<HTMLElement>(null);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const heroOrb1Y = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const heroOrb2Y = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const heroOrb3Y = useTransform(scrollYProgress, [0, 1], [0, 80]);

  React.useEffect(() => {
    document.title = "Welcome - TKS Alumni Portal";
  }, []);



  React.useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    return () => { document.documentElement.style.scrollBehavior = 'auto'; };
  }, []);

  React.useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleNavClick = (link: NavLinkConfig) => {
    if (link.type === "route") { setLocation(link.target); return; }
    const element = document.getElementById(link.target);
    if (element) element.scrollIntoView({ behavior: "smooth" });
  };

  const heroStagger = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.12, delayChildren: 0.1 } },
  };
  const heroChild = {
    hidden: { opacity: 0, y: 28 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.25, 0.1, 0.25, 1] } },
  };

  return (
    <div className="bg-slate-50 min-h-screen overflow-x-hidden">
      <Helmet>
        <title>Welcome - TKS Alumni Portal | Connect, Grow, Build Your Legacy</title>
        <meta name="description" content="Join thousands of TKS alumni worldwide. Reconnect with classmates, discover opportunities, and stay part of the family that shaped your journey." />
        <meta name="keywords" content="TKS Alumni, The Kalyani School, Alumni Portal, Alumni Network, Networking, Events, Reunions" />
        <link rel="canonical" href="https://tks-alumni.com" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="TKS Alumni Portal - Stay Connected, Grow Together" />
        <meta property="og:description" content="Join thousands of TKS alumni worldwide. Reconnect with classmates, discover opportunities, and build your legacy." />
        <meta property="og:url" content="https://tks-alumni.com" />
        <meta property="og:site_name" content="The Kalyani School Alumni Portal" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="TKS Alumni Portal" />
        <meta name="twitter:description" content="Connect with TKS alumni worldwide. Build your legacy." />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "The Kalyani School Alumni Portal",
            "description": "Alumni networking platform for The Kalyani School",
            "url": "https://tks-alumni.com",
            "logo": "https://tks-alumni.com/logo.png",
            "sameAs": ["https://facebook.com/tksalumni", "https://twitter.com/tksalumni", "https://linkedin.com/company/tksalumni"]
          })}
        </script>
      </Helmet>

      <LandingNavbar />

      {/* ═══════════════════════════════════════════════════════════════════════
          HERO — Split layout: left text + right alumni collage
          ═══════════════════════════════════════════════════════════════════════ */}
      <section ref={heroRef} id="home" className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white" style={{ paddingTop: '120px' }}>
        {/* Background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(99,102,241,0.07),transparent)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_50%_at_100%_50%,rgba(16,185,129,0.05),transparent)]" />
          <motion.div style={{ y: heroOrb1Y }} className="absolute -top-32 right-[15%] w-[500px] h-[500px] bg-primary-green-1/10 rounded-full blur-[100px]" />
          <motion.div style={{ y: heroOrb2Y }} className="absolute top-[60%] -left-24 w-[350px] h-[350px] bg-primary-green-2/10 rounded-full blur-[80px]" />
          <motion.div style={{ y: heroOrb3Y }} className="absolute -bottom-16 right-[30%] w-[300px] h-[300px] bg-primary-yellow/10 rounded-full blur-[80px]" />
          <div className="absolute inset-0 opacity-[0.25]" style={{ backgroundImage: 'radial-gradient(circle, rgba(148,163,184,0.2) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 pb-20 sm:pb-24 md:pb-28 lg:pb-32">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-16 items-center">

            {/* ── Left: Text (7 cols) ── */}
            <motion.div
              variants={heroStagger}
              initial="hidden"
              animate="visible"
              className="lg:col-span-7"
            >
              {/* Badge */}
              <motion.div variants={heroChild} className="mb-6">
                <span className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200/60 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-medium shadow-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  TKS Alumni Network
                </span>
              </motion.div>

              {/* Heading */}
              <motion.h1
                variants={heroChild}
                className="text-4xl sm:text-5xl md:text-[3.25rem] lg:text-[3.5rem] font-bold tracking-tight text-gray-900 leading-[1.1] mb-6"
              >
                Where TKS Alumni{" "}
                <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                  Reconnect
                </span>
                ,{" "}
                <span className="bg-gradient-to-r from-primary-green-1 to-primary-green-2 bg-clip-text text-transparent">
                  Grow
                </span>
                {" & Thrive"}
              </motion.h1>

              {/* Subtitle */}
              <motion.p
                variants={heroChild}
                className="text-lg text-gray-500 leading-relaxed mb-8 max-w-xl"
              >
                Join thousands of alumni worldwide. Build meaningful connections,
                discover career opportunities, and stay part of the family that
                shaped your journey.
              </motion.p>

              {/* CTA Row */}
              <motion.div variants={heroChild} className="flex flex-col sm:flex-row gap-3 mb-10">
                {user || adminUser ? (
                  <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button
                      className="bg-gray-900 hover:bg-gray-800 text-white px-7 py-3 h-auto text-[15px] font-semibold shadow-lg shadow-gray-900/10 hover:shadow-xl transition-all duration-300 rounded-xl inline-flex items-center justify-center gap-2"
                      onClick={() => setLocation(adminUser ? "/admin/dashboard" : "/feed")}
                    >
                      Go to Dashboard
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </motion.div>
                ) : (
                  <>
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <Button
                        className="bg-gray-900 hover:bg-gray-800 text-white px-7 py-3 h-auto text-[15px] font-semibold shadow-lg shadow-gray-900/10 hover:shadow-xl transition-all duration-300 rounded-xl inline-flex items-center justify-center gap-2"
                        onClick={() => setLocation("/signup")}
                      >
                        Join the Community
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                      <Button
                        variant="outline"
                        className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 px-7 py-3 h-auto text-[15px] font-medium transition-all duration-300 rounded-xl"
                        onClick={() => setLocation("/login")}
                      >
                        Sign In
                      </Button>
                    </motion.div>
                  </>
                )}
              </motion.div>

              {/* Stats row */}
              <motion.div variants={heroChild} className="flex flex-wrap items-center gap-6 sm:gap-8">
                {[
                  { value: "5,000+", label: "Alumni", color: "bg-emerald-500" },
                  { value: "50+", label: "Countries", color: "bg-primary-green-1" },
                  { value: "25+", label: "Years", color: "bg-primary-yellow" },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${stat.color}`} />
                    <span className="text-lg font-bold text-gray-900">{stat.value}</span>
                    <span className="text-sm text-gray-400">{stat.label}</span>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            {/* ── Right: Alumni collage (5 cols) ── */}
            <motion.div
              initial={{ opacity: 0, y: 32, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.9, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }}
              className="lg:col-span-5 hidden lg:block"
            >
              <div className="relative">
                {/* Outer glow */}
                <div className="absolute -inset-6 bg-gradient-to-br from-primary-green-1/20 via-primary-green-2/10 to-primary-yellow/15 rounded-[2rem] blur-2xl" />

                {/* Main image card */}
                <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-gray-400/20 border border-gray-200/60">
                  <img
                    src="/auth_hero_collage.png"
                    alt="TKS Alumni Community"
                    className="w-full object-cover"
                  />
                  {/* Bottom gradient overlay */}
                  <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white via-white/80 to-transparent" />
                  {/* Bottom info bar */}
                  <div className="absolute bottom-0 inset-x-0 px-5 pb-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-white rounded-lg shadow-sm border border-gray-100 flex items-center justify-center p-1">
                          <img src="/tks_logo.png" alt="TKS" className="w-full h-full object-contain" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 leading-tight">The Kalyani School</p>
                          <p className="text-xs text-gray-500">Since 2015</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200/60 px-3 py-1 rounded-full">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                        </span>
                        <span className="text-xs font-medium text-emerald-700">5K+ connected</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          GALLERY / VIDEO — bg-white, centered
          ═══════════════════════════════════════════════════════════════════════ */}
      <section id="gallery" className="py-20 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <RevealOnScroll>
            <AlumniPrideVideo />
          </RevealOnScroll>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          WHY JOIN — bg-slate-50, centered layout
          ═══════════════════════════════════════════════════════════════════════ */}
      <section id="about" className="py-20 md:py-24 bg-slate-50/80 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-6">
          <SectionHeader
            label="Why Choose Us"
            title="More Than Just A Directory"
            description="Being part of The Kalyani School community doesn't end at graduation. Our Alumni Portal is your gateway to lifelong connections."
            align="center"
          />
          <Suspense fallback={<SectionLoader />}>
            <WhyJoinSection />
          </Suspense>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          FEATURES — bg-white, LEFT-aligned header, split layout
          ═══════════════════════════════════════════════════════════════════════ */}
      <section id="features" className="py-20 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <SectionHeader
            label="Platform Features"
            title="Everything You Need, In One Place"
            description="From networking forums to private messaging and event updates — tools designed to keep you connected."
            align="left"
          />
          <Suspense fallback={<SectionLoader />}>
            <WhatYouWillFindSection />
          </Suspense>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          EVENTS — bg-gradient, centered layout
          ═══════════════════════════════════════════════════════════════════════ */}
      <section id="events" className="py-20 md:py-24 bg-gradient-to-b from-slate-50 to-slate-100/60 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/30 via-transparent to-emerald-50/20 pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-6">
          <SectionHeader
            label="Community Events"
            title="Stay Connected Through Events"
            description="Whether it's reunions, webinars, or networking sessions, our events bring the TKS community together."
            align="center"
          />
          <Suspense fallback={<SectionLoader />}>
            <UpcomingEventsSection />
          </Suspense>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          JOBS — bg-white, LEFT-aligned header
          ═══════════════════════════════════════════════════════════════════════ */}
      <section id="jobs" className="py-20 md:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-6">
          <SectionHeader
            label="Alumni Referrals"
            title="Opportunities From Your Network"
            description="Discover job opportunities shared exclusively by fellow TKS alumni — curated referrals to help you grow."
            align="left"
          />
          <Suspense fallback={<SectionLoader />}>
            <UpcomingJobsSection />
          </Suspense>
          <RevealOnScroll delay={0.2}>
            <div className="mt-12">
              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }} className="inline-block">
                <Button
                  onClick={() => {
                    if (user) { setLocation("/job-portal"); }
                    else { sessionStorage.setItem("redirectAfterLogin", "/job-portal"); setLocation("/login"); }
                  }}
                  variant="outline"
                  className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-400 px-7 py-2.5 rounded-xl font-medium transition-all inline-flex items-center gap-2"
                >
                  View All Job Openings
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </motion.div>
            </div>
          </RevealOnScroll>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          TRAVEL CHAPTER — world map + location cards
          ═══════════════════════════════════════════════════════════════════════ */}
      <section id="travel" className="py-20 md:py-24 bg-slate-50/80 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-white/60 via-transparent to-transparent pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-6">
          <SectionHeader
            label="City Chapter"
            title="TKS Alumni Across the Globe"
            description="From Pune to New York, Singapore to Sydney — our alumni have carried the TKS spirit to every corner of the world."
            align="center"
          />
          <Suspense fallback={<SectionLoader />}>
            <CityChapterSection />
          </Suspense>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════════
          CTA — dark section
          ═══════════════════════════════════════════════════════════════════════ */}
      <Suspense fallback={<SectionLoader />}>
        <CallToActionSection />
      </Suspense>

      {/* ═══════════════════════════════════════════════════════════════════════
          FOOTER — Light elegant design
          ═══════════════════════════════════════════════════════════════════════ */}
      <footer id="contact" className="relative bg-white border-t border-gray-200/80" role="contentinfo">
        {/* Subtle top gradient fade */}
        <div className="absolute top-0 inset-x-0 h-32 bg-gradient-to-b from-slate-50/80 to-transparent pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 pt-16 pb-10 md:pt-20 md:pb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-12 mb-14">
            {/* Brand */}
            <div className="lg:col-span-5 space-y-5">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 flex items-center justify-center overflow-hidden p-1.5 flex-shrink-0 shadow-sm">
                  <img src="/tks_logo.png" alt="The Kalyani School Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 leading-tight">The Kalyani School</h2>
                  <p className="text-gray-400 text-sm font-medium">Alumni Portal</p>
                </div>
              </div>
              <p className="text-gray-500 leading-relaxed text-sm max-w-md">
                Connecting generations of TKS alumni worldwide. Stay connected, grow together, and build lasting relationships that matter.
              </p>
              <div className="flex gap-2.5">
                {(() => {
                  const iconMap: Record<string, React.ComponentType<{ className?: string }>> = { instagram: Instagram, facebook: Facebook, linkedin: Linkedin, x: X, globe: Globe };
                  return SOCIAL_LINKS.map(({ href, label, iconKey }) => {
                    const Icon = iconMap[iconKey];
                    return (
                      <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                        className="w-10 h-10 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-center hover:bg-gray-100 hover:border-gray-300 hover:shadow-sm transition-all duration-300"
                        aria-label={`Visit our ${label} page`}>
                        <Icon className="w-4 h-4 text-gray-500" />
                      </a>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Quick Links */}
            <div className="lg:col-span-3">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">Quick Links</h3>
              <nav aria-label="Footer navigation">
                <ul className="space-y-3">
                  {FOOTER_QUICK_LINKS.map((link) => (
                    <li key={link.label}>
                      <a href={link.type === "route" ? link.target : `#${link.target}`}
                        onClick={(e) => { e.preventDefault(); handleNavClick(link); }}
                        className="text-gray-500 hover:text-gray-900 transition-colors duration-200 text-sm font-medium">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            {/* Contact */}
            <div className="lg:col-span-4">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-5">Contact Us</h3>
              <address className="not-italic space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <a href="https://maps.google.com/maps?ll=18.514382,73.976835&z=12&t=m&hl=en&gl=IN&mapclient=embed&cid=16311474357462256784"
                    target="_blank" rel="noopener noreferrer"
                    className="text-sm text-gray-500 hover:text-gray-900 transition-colors leading-relaxed">
                    Manjari (Budruk), Near Hadapsar,<br />Pune 412307, Maharashtra, India
                  </a>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <div className="flex flex-col gap-1 pt-1.5">
                    {['+91 8149117666', '+91 8149118666'].map((phone) => (
                      <a key={phone} href={`tel:${phone.replace(/\s/g, '')}`} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">{phone}</a>
                    ))}
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Mail className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                  <a href="mailto:info@thekalyanischool.edu.in" className="text-sm text-gray-500 hover:text-gray-900 transition-colors pt-1.5">info@thekalyanischool.edu.in</a>
                </div>
              </address>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="border-t border-gray-200 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} The Kalyani School Alumni Portal. All rights reserved.</p>
            <div className="flex items-center gap-6 pr-14">
              {['Terms of Service', 'Privacy Policy'].map((item) => (
                <a key={item} href="#" className="text-sm text-gray-400 hover:text-gray-700 transition-colors" onClick={(e) => e.preventDefault()}>{item}</a>
              ))}
              <span className="text-gray-300">|</span>
              <a
                href="https://www.evonix.co/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity duration-200"
              >
                <span className="text-sm text-gray-400">Crafted by</span>
                <img src="/evonix_logo.webp" alt="Evonix" className="h-4 w-auto" />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Scroll to Top */}
      <AnimatePresence>
        {showScrollTop && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="fixed bottom-6 right-6 z-50 bg-white hover:bg-gray-50 text-gray-700 rounded-full p-3 shadow-lg border border-gray-200 hover:shadow-xl hover:border-gray-300 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-green-1/30 focus:ring-offset-2"
            aria-label="Scroll to top"
          >
            <ArrowUp className="w-5 h-5" />
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
};
