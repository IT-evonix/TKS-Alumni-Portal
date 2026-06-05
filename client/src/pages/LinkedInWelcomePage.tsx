import React, { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowRight, Home, CheckCircle2 } from "lucide-react";

export const LinkedInWelcomePage = (): JSX.Element => {
  const [, setLocation] = useLocation();
  const [prefill, setPrefill] = useState<{
    fn: string;
    ln: string;
    email: string;
    pic: string;
    sub: string;
  } | null>(null);

  useEffect(() => {
    document.title = "Welcome - TKS Alumni Portal";
    const params = new URLSearchParams(window.location.search);
    const sub = params.get("li_sub");

    if (!sub) {
      setLocation("/login?linkedin_error=invalid_state");
      return;
    }

    setPrefill({
      fn: decodeURIComponent(params.get("li_fn") || ""),
      ln: decodeURIComponent(params.get("li_ln") || ""),
      email: decodeURIComponent(params.get("li_email") || ""),
      pic: decodeURIComponent(params.get("li_pic") || ""),
      sub: decodeURIComponent(sub),
    });

    // Clean URL — params are now in state
    window.history.replaceState({}, "", "/linkedin-welcome");
  }, [setLocation]);

  const handleCompleteSignup = () => {
    if (!prefill) return;
    const params = new URLSearchParams({
      li_fn: prefill.fn,
      li_ln: prefill.ln,
      li_email: prefill.email,
      li_pic: prefill.pic,
      li_sub: prefill.sub,
    });
    setLocation(`/signup?${params.toString()}`);
  };

  if (!prefill) return <></>;

  const displayName = prefill.fn || "there";
  const initials = `${prefill.fn?.[0] || ""}${prefill.ln?.[0] || ""}`.toUpperCase() || "?";

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden">
      {/* Left Side */}
      <div className="w-full lg:w-1/2 h-full overflow-y-auto overflow-x-hidden flex flex-col relative z-10 scrollbar-hide">
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none"></div>

        <div className="flex-1 flex items-center justify-center p-6 sm:p-8 md:p-12">
          <div className="w-full max-w-[420px] space-y-8 animate-fade-up">

            {/* Nav */}
            <div className="flex justify-between items-center">
              <Link href="/">
                <Button variant="ghost" size="sm" className="text-gray-500 hover:text-primary-green-1 font-bold flex items-center gap-2 group/home">
                  <Home className="w-4 h-4 group-hover/home:-translate-x-1 transition-transform" />
                  Home
                </Button>
              </Link>
            </div>

            {/* Profile Card */}
            <div className="flex flex-col items-center space-y-5 text-center">
              {/* LinkedIn badge */}
              <div className="flex items-center gap-2 text-xs font-bold text-[#0A66C2] bg-[#0A66C2]/8 border border-[#0A66C2]/20 rounded-full px-4 py-1.5">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
                LinkedIn Verified
              </div>

              {/* Avatar */}
              <div className="relative">
                {prefill.pic ? (
                  <img
                    src={prefill.pic}
                    alt={`${prefill.fn} ${prefill.ln}`}
                    className="w-24 h-24 rounded-full object-cover ring-4 ring-[#008060]/20 shadow-xl"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#008060] to-[#a6ce39] flex items-center justify-center text-white text-3xl font-black shadow-xl ring-4 ring-[#008060]/20">
                    {initials}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-7 h-7 bg-[#008060] rounded-full flex items-center justify-center shadow-md">
                  <CheckCircle2 className="w-4 h-4 text-white" />
                </div>
              </div>

              {/* Greeting */}
              <div className="space-y-2">
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                  Welcome, {displayName}!
                </h1>
                <p className="text-gray-500 text-base font-medium leading-relaxed max-w-sm mx-auto">
                  We verified your LinkedIn identity. To join the TKS Alumni Portal, please complete your registration below.
                </p>
                {prefill.email && (
                  <p className="text-sm text-gray-400 font-medium">
                    LinkedIn email: <span className="text-gray-600 font-semibold">{prefill.email}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Info box */}
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 text-sm text-emerald-700 font-medium space-y-1">
              <p className="font-bold text-emerald-800">What happens next?</p>
              <p>Your name and email will be pre-filled. You'll need to add your graduation year, account type, and a few other details.</p>
              <p>An admin will review your request before your account is created.</p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <Button
                onClick={handleCompleteSignup}
                className="w-full bg-primary-green-1 hover:bg-primary-green-2 text-white py-6 rounded-xl font-bold text-lg shadow-lg shadow-green-900/10 hover:shadow-xl active:scale-[0.98] transition-all group"
              >
                <span className="flex items-center gap-2">
                  Complete Your Registration
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setLocation("/login")}
                className="w-full text-gray-500 hover:text-gray-700 py-4 rounded-xl font-medium"
              >
                Sign in with email instead
              </Button>
            </div>

            <p className="text-center text-xs text-gray-400">
              &copy; {new Date().getFullYear()} The Kalyani School. All rights reserved.
            </p>
          </div>
        </div>
      </div>

      {/* Right Side: Hero */}
      <div className="hidden lg:flex lg:w-1/2 h-full relative overflow-hidden bg-[#001a14] flex-col justify-end">
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/20 z-10"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(16,185,129,0.22),transparent_42%),radial-gradient(circle_at_80%_30%,rgba(166,206,57,0.18),transparent_40%)] z-10"></div>
        <div className="absolute inset-0 z-0">
          <img src="/auth_hero_students.png" alt="Alumni Community" className="w-full h-full object-cover" />
        </div>
        <div className="relative z-20 w-full p-8 xl:p-12 animate-fade-up">
          <div className="relative max-w-md">
            <div className="relative p-6 xl:p-8 rounded-3xl bg-black/45 backdrop-blur-xl border border-white/30 overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.55)]">
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20"></div>
              <div className="relative space-y-5">
                <div className="flex items-center gap-3">
                  <div className="h-0.5 w-6 bg-gradient-to-r from-primary-green-1 to-primary-yellow"></div>
                  <span className="px-2 py-1 rounded-full bg-black/35 border border-white/20 text-[11px] font-black uppercase tracking-[0.25em] text-emerald-100">Legacy & Tradition</span>
                </div>
                <p className="text-xl xl:text-2xl font-semibold text-white leading-relaxed italic tracking-tight drop-shadow-[0_3px_10px_rgba(0,0,0,0.75)]">
                  "Reconnect with the mentors who guided you, the friends who stood by you, and the school that shaped you."
                </p>
                <div className="flex items-center gap-4 pt-5 border-t border-white/20">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-br from-primary-green-1 to-primary-yellow rounded-xl blur-sm opacity-50"></div>
                    <div className="relative w-10 h-10 bg-gray-900 rounded-xl flex items-center justify-center font-black text-primary-yellow text-sm border border-white/10">TKS</div>
                  </div>
                  <div>
                    <p className="text-base font-black tracking-tight text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]">The Kalyani School</p>
                    <p className="text-[11px] font-bold text-emerald-200 uppercase tracking-[0.25em]">Official Alumni Network</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
