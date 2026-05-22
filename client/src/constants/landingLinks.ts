/**
 * Single source of truth for landing page navigation and footer links.
 * Used by header nav, mobile nav, and footer Quick Links.
 */

export type NavLinkType = "scroll" | "route";

export interface NavLinkConfig {
  label: string;
  type: NavLinkType;
  /** For scroll: section id (e.g. "about"). For route: path (e.g. "/contact") */
  target: string;
  /** Optional: when type is "route", use this for login redirect (e.g. "/connections") */
  returnUrl?: string;
}

/** Header/main nav: scroll sections + Contact + Jobs */
export const HEADER_NAV_LINKS: NavLinkConfig[] = [
  { label: "Gallery", type: "scroll", target: "gallery" },
  { label: "About", type: "scroll", target: "about" },
  { label: "Features", type: "scroll", target: "features" },
  { label: "Events", type: "scroll", target: "events" },
  { label: "Jobs", type: "scroll", target: "jobs" },
  { label: "Contact", type: "scroll", target: "contact" },
];

/** Footer Quick Links: subset + Jobs */
export const FOOTER_QUICK_LINKS: NavLinkConfig[] = [
  { label: "Home", type: "scroll", target: "home" },
  { label: "About", type: "scroll", target: "about" },
  { label: "Events", type: "scroll", target: "events" },
  { label: "Jobs", type: "scroll", target: "jobs" },
  { label: "Contact", type: "scroll", target: "contact" },
];


export interface SocialLinkConfig {
  href: string;
  label: string;
  /** Lucide icon name - component passed from LandingPage */
  iconKey: "instagram" | "facebook" | "linkedin" | "x" | "globe";
}

export const SOCIAL_LINKS: SocialLinkConfig[] = [
  { href: "https://www.instagram.com/kalyanischool", label: "Instagram", iconKey: "instagram" },
  { href: "https://www.facebook.com/KalyaniSchool", label: "Facebook", iconKey: "facebook" },
  { href: "https://www.linkedin.com/company/the-kalyani-school", label: "LinkedIn", iconKey: "linkedin" },
  { href: "https://x.com/KalyaniSchool", label: "X (Twitter)", iconKey: "x" },
  { href: "https://www.thekalyanischool.com/", label: "School Website", iconKey: "globe" },
];
