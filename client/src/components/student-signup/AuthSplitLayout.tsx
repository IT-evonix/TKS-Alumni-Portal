import React from "react";
import { Link } from "wouter";
import { Home, BookOpen, Globe, ShieldCheck } from "lucide-react";

export interface HeroCaption {
  eyebrow: string;
  text: string;
}

interface AuthSplitLayoutProps {
  caption: HeroCaption;
  scrollRef?: React.RefObject<HTMLDivElement>;
  children: React.ReactNode;
}

const BENEFITS = [
  { icon: BookOpen, tone: "bg-[#A6CE39]/20 ring-[#A6CE39]/40 text-[#A6CE39]", title: "Your school record, ready for life after TKS" },
  { icon: Globe, tone: "bg-[#FDB913]/20 ring-[#FDB913]/40 text-[#FDB913]", title: "Direct access to alumni in top universities" },
  { icon: ShieldCheck, tone: "bg-emerald-400/20 ring-emerald-300/40 text-emerald-300", title: "Verified, school-authorised student account" },
];

export const AuthSplitLayout = ({ caption, scrollRef, children }: AuthSplitLayoutProps) => (
  <div className="flex min-h-dvh w-full bg-[#f6faf8] lg:h-dvh lg:overflow-hidden">
    {/* Hero (≥lg) */}
    <aside className="relative hidden w-[44%] max-w-[640px] shrink-0 flex-col justify-between gap-8 overflow-hidden bg-[#001a14] p-10 xl:p-14 lg:flex">
      <img src="/auth_hero_students.png" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover" />
      {/* Scrim: dark enough behind every text block for AA contrast, photo still visible in the gaps */}
      <div className="absolute inset-0 bg-[#002a20]/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#001a14]/90 via-[#002a20]/35 to-[#001a14]/95" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#001a14]/70 via-[#001a14]/25 to-transparent" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_10%_0%,rgba(52,211,153,0.22),transparent_40%),radial-gradient(circle_at_100%_100%,rgba(166,206,57,0.16),transparent_40%)]" />

      <Link href="/" className="relative z-10 flex items-center gap-3 self-start">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white p-1.5 shadow-lg">
          <img src="/tks_logo.png" alt="" className="h-full w-full object-contain" />
        </span>
        <span className="leading-tight text-white">
          <span className="block text-lg font-extrabold tracking-tight">The Kalyani School</span>
          <span className="block text-xs font-bold uppercase tracking-[0.2em] text-[#B9E04A]">Student Portal</span>
        </span>
      </Link>

      <div className="relative z-10 space-y-6">
        <div className="space-y-4">
          <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)] xl:text-5xl">
            Your TKS journey <span className="text-[#A6CE39]">starts here.</span>
          </h1>
          <p className="max-w-md text-base font-medium leading-relaxed text-white [text-shadow:0_1px_8px_rgba(0,0,0,0.85)]">
            Create your student account in under two minutes and join the school's network.
          </p>
        </div>
        <ul className="space-y-3 [text-shadow:0_1px_8px_rgba(0,0,0,0.85)] [@media(max-height:720px)]:hidden">
          {BENEFITS.map(({ icon: Icon, tone, title }) => (
            <li key={title} className="flex items-center gap-3 text-sm font-medium text-white">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 backdrop-blur ${tone}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>
              {title}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative z-10 rounded-2xl border border-white/15 border-l-4 border-l-[#A6CE39] bg-[#00110c]/85 p-5 shadow-xl backdrop-blur-xl" aria-live="polite">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#A6CE39]">{caption.eyebrow}</p>
        <p className="mt-1.5 text-sm leading-relaxed text-white">{caption.text}</p>
      </div>
    </aside>

    {/* Form column */}
    <div ref={scrollRef} className="relative flex min-w-0 flex-1 flex-col bg-[radial-gradient(ellipse_at_top_right,rgba(166,206,57,0.14),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(0,128,96,0.10),transparent_55%)] lg:overflow-y-auto">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 hidden h-1 bg-gradient-to-r from-[#008060] via-[#A6CE39] to-[#FDB913] lg:block" aria-hidden="true" />
      {/* Mobile / tablet brand strip */}
      <header className="relative overflow-hidden bg-gradient-to-br from-[#006b51] via-[#008060] to-[#3f9b56] px-4 pb-6 pt-4 text-white sm:px-8 lg:hidden">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-[520px] items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white p-1">
              <img src="/tks_logo.png" alt="" className="h-full w-full object-contain" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold">The Kalyani School</span>
              <span className="block text-[11px] font-semibold uppercase tracking-widest text-emerald-100">Student Portal</span>
            </span>
          </Link>
          <Link
            href="/login"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/40 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Desktop top bar */}
      <div className="hidden items-center justify-between px-10 pt-8 lg:flex xl:px-14">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-semibold text-gray-600 hover:text-[#008060] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008060]/40"
        >
          <Home className="h-4 w-4" aria-hidden="true" /> Home
        </Link>
        <p className="text-sm text-gray-600">
          Already registered?{" "}
          <Link href="/login" className="font-bold text-[#008060] underline-offset-4 hover:underline">
            Sign in
          </Link>
        </p>
      </div>

      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col px-4 pb-0 pt-6 sm:px-6 lg:justify-center lg:px-10 lg:py-10">
        {children}
      </main>

      <p className="hidden px-10 pb-6 text-center text-xs text-gray-500 lg:block">
        &copy; {new Date().getFullYear()} The Kalyani School. All rights reserved.
      </p>
    </div>
  </div>
);
