export const INTEREST_CATEGORIES: Record<string, string[]> = {
  "Tech Domains": [
    "AI/ML",
    "Web Development",
    "Mobile Development",
    "Data Science",
    "Cybersecurity",
    "Cloud Computing",
    "Blockchain",
    "DevOps",
    "Embedded Systems",
  ],
  "Career Goals": [
    "Startup Founder",
    "Product Management",
    "Engineering Leadership",
    "Research & Academia",
    "Industry Switch",
    "Freelancing",
    "VC & Investing",
  ],
  "Soft Skills": [
    "Public Speaking",
    "Networking",
    "Negotiation",
    "Work-Life Balance",
    "Team Management",
    "Personal Branding",
  ],
  "Industry Verticals": [
    "Fintech",
    "Healthtech",
    "Edtech",
    "Deep Tech",
    "SaaS / B2B",
    "E-Commerce",
    "Consulting",
    "Government & Policy",
  ],
};

export const ALL_INTERESTS = Object.values(INTEREST_CATEGORIES).flat();
