import React from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, Mail } from "lucide-react";
import { Helmet } from "react-helmet-async";
import { LandingNavbar } from "@/components/common/LandingNavbar";

export const ContactUsPage = (): JSX.Element => {
  const [, setLocation] = useLocation();

  return (
    <div className="bg-white min-h-screen relative overflow-hidden">
      {/* SEO Meta Tags */}
      <Helmet>
        <title>Contact Us - The Kalyani School Alumni Portal</title>
        <meta name="description" content="Get in touch with The Kalyani School. Find our address, phone numbers, and email contacts for various departments." />
      </Helmet>

      {/* Decorative Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Primary Gradient Base */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-gray-50"></div>

        {/* Animated Mesh Gradient */}
        <div className="absolute inset-0 opacity-30 animate-gradient-shift" style={{
          background: `
            radial-gradient(ellipse 80% 50% at 20% 40%, rgba(0, 128, 96, 0.08) 0%, transparent 70%),
            radial-gradient(ellipse 60% 40% at 80% 60%, rgba(0, 92, 69, 0.06) 0%, transparent 70%),
            radial-gradient(ellipse 100% 80% at 40% 20%, rgba(0, 128, 96, 0.04) 0%, transparent 80%)
          `
        }}></div>

        {/* Floating Orbs */}
        <div className="absolute top-20 right-20 w-72 h-72 bg-gradient-to-br from-[#008060]/15 to-[#005c45]/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-20 w-96 h-96 bg-gradient-to-br from-[#006b51]/12 to-[#008060]/8 rounded-full blur-3xl"></div>

        {/* Dot Pattern */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(0, 128, 96, 0.3) 1px, transparent 1px)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      {/* ── Landing Page Navbar ────────────────────────────────────────── */}
      <LandingNavbar />


      {/* Contact Section */}
      <section className="relative pt-32 pb-12 sm:pt-40 sm:pb-16 lg:pt-48 lg:pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          {/* Page Title */}
          <div className="text-center mb-12 sm:mb-16 animate-fade-up">
            <div className="inline-block mb-4">
              <span className="bg-gradient-to-r from-[#008060]/10 to-[#005c45]/10 text-[#008060] px-4 py-2 rounded-full text-xs sm:text-sm font-semibold uppercase tracking-wide shadow-lg border border-[#008060]/20">
                Contact Information
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6">
              <span className="bg-gradient-to-r from-[#008060] via-[#006b51] to-[#005c45] bg-clip-text text-transparent">
                Get in Touch
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-700 max-w-3xl mx-auto leading-relaxed">
              We'd love to hear from you. Reach out to us through any of the channels below.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Map Section */}
            <div className="order-2 lg:order-1 animate-fade-up" style={{ animationDelay: '100ms' }}>
              <div className="w-full h-96 sm:h-[500px] rounded-2xl sm:rounded-3xl overflow-hidden shadow-lg border border-gray-200 bg-gray-100">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d7566.651631286696!2d73.97609!3d18.514173!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc2c266d7bffd79%3A0xe25dff81976e4c90!2sThe%20Kalyani%20School!5e0!3m2!1sen!2sus!4v1684914060268!5m2!1sen!2sus"
                  width="100%"
                  height="100%"
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="The Kalyani School Location"
                ></iframe>
              </div>
            </div>

            {/* Contact Information - horizontal scroll on small/medium, vertical stack on large */}
            <div className="order-1 lg:order-2 flex lg:flex-col overflow-x-auto lg:overflow-visible gap-4 lg:gap-5 snap-x snap-mandatory pb-2 lg:pb-0 scroll-px-4 lg:scroll-px-0">
              {/* Address Card */}
              <div className="group relative min-w-[280px] sm:min-w-[300px] lg:min-w-0 flex-shrink-0 lg:flex-shrink snap-start bg-gradient-to-br from-white via-white to-[#008060]/5 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-lg border border-[#008060]/10 hover:shadow-xl hover:border-[#008060]/20 transition-all duration-300 animate-fade-up" style={{ animationDelay: '200ms' }}>
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#008060] to-[#006b51] flex items-center justify-center shrink-0 shadow-md group-hover:scale-110 transition-transform duration-300">
                    <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base sm:text-lg mb-2 text-gray-900">Address</h3>
                    <a
                      href="https://maps.google.com/maps?ll=18.514382,73.976835&z=12&t=m&hl=en&gl=IN&mapclient=embed&cid=16311474357462256784"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-700 hover:text-[#008060] font-medium text-sm sm:text-base leading-relaxed hover:underline decoration-[#008060] decoration-2 underline-offset-2 transition-all block"
                    >
                      <span className="font-bold text-gray-900">The Kalyani School</span>,<br />
                      Manjari (Budruk), Near Hadapsar,<br />
                      Pune 412307, Maharashtra, India
                    </a>
                  </div>
                </div>
              </div>

              {/* Phone Card */}
              <div className="group relative min-w-[280px] sm:min-w-[300px] lg:min-w-0 flex-shrink-0 lg:flex-shrink snap-start bg-gradient-to-br from-white via-white to-[#006b51]/5 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-lg border border-[#006b51]/10 hover:shadow-xl hover:border-[#006b51]/20 transition-all duration-300 animate-fade-up" style={{ animationDelay: '300ms' }}>
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#006b51] to-[#005c45] flex items-center justify-center shrink-0 shadow-md group-hover:scale-110 transition-transform duration-300">
                    <Phone className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base sm:text-lg mb-2 text-gray-900">Connect with us</h3>
                    <div className="flex flex-col gap-1.5">
                      {['+91 8149117666', '+91 8149118666', '+91 8149119666'].map((phone) => (
                        <a
                          key={phone}
                          href={`tel:${phone.replace(/\s/g, '')}`}
                          className="text-sm sm:text-base font-semibold text-[#006b51] hover:text-[#005c45] transition-colors hover:translate-x-1 inline-block"
                        >
                          {phone}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Email Card */}
              <div className="group relative min-w-[280px] sm:min-w-[300px] lg:min-w-0 flex-shrink-0 lg:flex-shrink snap-start bg-gradient-to-br from-white via-white to-[#005c45]/5 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-lg border border-[#005c45]/10 hover:shadow-xl hover:border-[#005c45]/20 transition-all duration-300 animate-fade-up" style={{ animationDelay: '400ms' }}>
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-[#005c45] to-[#004d3a] flex items-center justify-center shrink-0 shadow-md group-hover:scale-110 transition-transform duration-300">
                    <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base sm:text-lg mb-2 text-gray-900">Email Contacts</h3>
                    <div className="space-y-1.5 text-xs sm:text-sm">
                      {[
                        { label: 'General', email: 'info@thekalyanischool.edu.in' },
                        { label: 'Admissions', email: 'admissions1@thekalyanischool.edu.in' },
                        { label: 'Transport', email: 'transport@thekalyanischool.edu.in' },
                        { label: 'Accounts', email: 'accounts@thekalyanischool.edu.in' },
                        { label: 'Admin', email: 'admin1@thekalyanischool.edu.in' },
                        { label: 'HR', email: 'hr1@thekalyanischool.edu.in' }
                      ].map(({ label, email }) => (
                        <div key={email} className="group/item">
                          <span className="text-gray-600 font-medium">{label}: </span>
                          <a
                            href={`mailto:${email}`}
                            className="font-semibold text-[#005c45] hover:text-[#004d3a] hover:underline decoration-2 underline-offset-2 transition-all break-all"
                          >
                            {email}
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
