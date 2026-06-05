import React from "react";
import { useLocation } from "wouter";
import { MapPin, Phone, Mail, Facebook, Linkedin, Instagram, X, Globe } from "lucide-react";
import { FOOTER_QUICK_LINKS, SOCIAL_LINKS, type NavLinkConfig } from "@/constants/landingLinks";

export const LandingFooter = () => {
  const [, setLocation] = useLocation();

  const handleNavClick = (link: NavLinkConfig) => {
    if (link.type === "route") {
      setLocation(link.target);
      return;
    }
    const element = document.getElementById(link.target);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    } else {
      // If we are on a different page (like AlumniMapPage) and clicking a hash link, go to home page first
      if (link.target.startsWith("#") || !link.target.startsWith("/")) {
        setLocation(`/#${link.target}`);
      }
    }
  };

  return (
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
  );
};
