import React from "react";
import { useLocation } from "wouter";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { HEADER_NAV_LINKS, type NavLinkConfig } from "@/constants/landingLinks";
import { motion, AnimatePresence } from "framer-motion";

export const LandingNavbar = (): JSX.Element => {
    const [location, setLocation] = useLocation();
    const { user, logout } = useAuth();
    const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
    const [scrolled, setScrolled] = React.useState(false);

    React.useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMobileMenuOpen(false);
        };
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, []);

    React.useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 10);
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleAuthAction = () => {
        if (user) { logout(); } else { setLocation("/login"); }
    };

    const handleNavClick = (link: NavLinkConfig) => {
        setMobileMenuOpen(false);
        if (link.type === "route") {
            const path = link.target;
            if (path === "/contact" && location === "/contact") return;
            if (path === "/connections" || path === "/job-portal") {
                if (user) { setLocation(path); }
                else { setLocation(`/login?returnUrl=${encodeURIComponent(link.returnUrl || path)}`); }
                return;
            }
            setLocation(path);
            return;
        }
        if (location !== "/") { window.location.href = `/#${link.target}`; return; }
        const element = document.getElementById(link.target);
        if (element) element.scrollIntoView({ behavior: "smooth" });
    };

    return (
        <>
            <motion.header
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className={`fixed top-0 z-50 w-full transition-all duration-300 ${
                    scrolled
                        ? 'bg-white/90 backdrop-blur-2xl border-b border-gray-200/70 shadow-sm'
                        : 'bg-white/60 backdrop-blur-lg border-b border-transparent'
                }`}
                role="banner"
            >
                <div className="max-w-7xl mx-auto px-6 sm:px-10 lg:px-12">
                    <div className="flex items-center justify-between h-20 sm:h-24 md:h-24">
                        {/* Brand */}
                        <button
                            className="flex items-center gap-2.5 sm:gap-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
                            onClick={() => handleNavClick({ label: "Home", type: "scroll", target: "top" })}
                            aria-label="Go to top"
                        >
                            <div className="relative w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0">
                                <div className="w-full h-full bg-white rounded-xl shadow-md group-hover:shadow-lg transition-shadow duration-300 flex items-center justify-center overflow-hidden p-1 border border-gray-200">
                                    <img src="/tks_logo.png" alt="The Kalyani School Logo" className="w-full h-full object-contain" />
                                </div>
                            </div>
                            <div className="flex flex-col leading-tight text-left">
                                <span className="font-bold text-sm sm:text-base md:text-lg text-gray-900 group-hover:text-gray-700 transition-colors duration-200">
                                    The Kalyani School
                                </span>
                                <span className="text-[10px] sm:text-xs text-gray-500 font-semibold uppercase tracking-widest">
                                    Alumni Portal
                                </span>
                            </div>
                        </button>

                        {/* Desktop Nav */}
                        <nav className="hidden lg:flex items-center gap-1 xl:gap-1.5" role="navigation" aria-label="Main navigation">
                            {HEADER_NAV_LINKS.map((link) => (
                                <a
                                    key={link.label}
                                    href={link.type === "route" ? link.target : `/#${link.target}`}
                                    className="relative px-3 xl:px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors duration-200 rounded-lg hover:bg-gray-100/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 whitespace-nowrap"
                                    onClick={(e) => {
                                        if (link.type === "scroll" || link.target === location) e.preventDefault();
                                        handleNavClick(link);
                                    }}
                                    aria-label={`Navigate to ${link.label}`}
                                >
                                    {link.label}
                                </a>
                            ))}
                        </nav>

                        {/* CTA + Mobile */}
                        <div className="flex items-center gap-2 sm:gap-3">
                            <button
                                className="lg:hidden p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                aria-label="Toggle mobile menu"
                                aria-expanded={mobileMenuOpen}
                            >
                                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                            </button>

                            {user ? (
                                <Button
                                    className="bg-gray-900 hover:bg-gray-800 text-white text-xs sm:text-sm font-medium px-4 sm:px-5 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-300"
                                    onClick={handleAuthAction}
                                    aria-label="Log out"
                                >
                                    Log Out
                                </Button>
                            ) : (
                                <Button
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold px-4 sm:px-6 py-2 rounded-lg shadow-sm hover:shadow-md transition-all duration-300"
                                    onClick={handleAuthAction}
                                    aria-label="Register or login"
                                >
                                    <span className="hidden sm:inline">Register / </span>
                                    <span>Login</span>
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </motion.header>

            {/* Mobile Drawer */}
            <AnimatePresence>
                {mobileMenuOpen && (
                    <div className="lg:hidden fixed inset-0 z-40" role="dialog" aria-modal="true">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
                            onClick={() => setMobileMenuOpen(false)}
                        />
                        <motion.div
                            initial={{ x: "100%" }}
                            animate={{ x: 0 }}
                            exit={{ x: "100%" }}
                            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                            className="absolute right-0 top-0 bottom-0 w-[300px] bg-white shadow-2xl flex flex-col"
                        >
                            <div className="p-6 flex items-center justify-between border-b border-gray-100">
                                <span className="font-semibold text-gray-900">Menu</span>
                                <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500" aria-label="Close menu">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                                {HEADER_NAV_LINKS.map((link, i) => (
                                    <motion.button
                                        key={link.label}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.05, duration: 0.3 }}
                                        className="w-full flex items-center px-4 py-3 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-200"
                                        onClick={() => handleNavClick(link)}
                                    >
                                        {link.label}
                                    </motion.button>
                                ))}
                            </nav>
                            <div className="p-6 border-t border-gray-100 space-y-3">
                                {user ? (
                                    <Button className="w-full bg-gray-900 hover:bg-gray-800 py-3 rounded-lg font-semibold text-white" onClick={handleAuthAction}>Log Out</Button>
                                ) : (
                                    <>
                                        <Button variant="outline" className="w-full py-3 rounded-lg font-medium border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => { setMobileMenuOpen(false); setLocation("/login"); }}>Login</Button>
                                        <Button className="w-full bg-emerald-600 hover:bg-emerald-700 py-3 rounded-lg font-semibold text-white" onClick={() => { setMobileMenuOpen(false); setLocation("/signup"); }}>Join Now</Button>
                                    </>
                                )}
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </>
    );
};
