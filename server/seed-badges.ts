/**
 * Seed default gamification badges into the database
 * Run with: npx tsx server/seed-badges.ts
 */
import { supabase } from "./supabase";

const defaultBadges = [
  // Common badges (one-time milestones)
  {
    name: "Login Streak",
    description: "Maintained a consecutive daily login streak.",
    category: "series",
    series_type: "login",
    required_score: 1,
    tier: "bronze",
    icon_url: "🎯",
    is_enabled: true,
    display_order: 1,
  },
  {
    name: "Login Streak",
    description: "Maintained a consecutive daily login streak.",
    category: "series",
    series_type: "login",
    required_score: 7,
    tier: "silver",
    icon_url: "🔥",
    is_enabled: true,
    display_order: 2,
  },
  {
    name: "Login Streak",
    description: "Maintained a consecutive daily login streak.",
    category: "series",
    series_type: "login",
    required_score: 30,
    tier: "gold",
    icon_url: "🔥",
    is_enabled: true,
    display_order: 3,
  },
  {
    name: "Login Streak",
    description: "Maintained a consecutive daily login streak.",
    category: "series",
    series_type: "login",
    required_score: 100,
    tier: "platinum",
    icon_url: "👑",
    is_enabled: true,
    display_order: 4,
  },
  {
    name: "Profile Pro",
    description: "Completed your alumni profile with all key details.",
    category: "common",
    series_type: "profile",
    required_score: 0,
    tier: "bronze",
    icon_url: null,
    is_enabled: true,
    display_order: 2,
  },
  // Thread series badges
  {
    name: "Conversation Starter",
    description: "Made your first post or comment in the community feed.",
    category: "series",
    series_type: "thread",
    required_score: 1,
    tier: "bronze",
    icon_url: null,
    is_enabled: true,
    display_order: 10,
  },
  {
    name: "Active Contributor",
    description: "Contributed 5 posts or comments in the community.",
    category: "series",
    series_type: "thread",
    required_score: 5,
    tier: "silver",
    icon_url: null,
    is_enabled: true,
    display_order: 11,
  },
  {
    name: "Community Voice",
    description: "Reached 15 posts or comments. Your voice matters!",
    category: "series",
    series_type: "thread",
    required_score: 15,
    tier: "gold",
    icon_url: null,
    is_enabled: true,
    display_order: 12,
  },
  // Event series badges
  {
    name: "Event Explorer",
    description: "Attended your first alumni event. Great to see you!",
    category: "series",
    series_type: "event",
    required_score: 1,
    tier: "bronze",
    icon_url: null,
    is_enabled: true,
    display_order: 20,
  },
  {
    name: "Event Enthusiast",
    description: "Attended 5 alumni events. You're a regular!",
    category: "series",
    series_type: "event",
    required_score: 5,
    tier: "silver",
    icon_url: null,
    is_enabled: true,
    display_order: 21,
  },
  {
    name: "Event Champion",
    description: "Attended 15 events. A true community pillar!",
    category: "series",
    series_type: "event",
    required_score: 15,
    tier: "gold",
    icon_url: null,
    is_enabled: true,
    display_order: 22,
  },
  // Connection series badges
  {
    name: "Networker",
    description: "Made your first alumni connection.",
    category: "series",
    series_type: "connection",
    required_score: 1,
    tier: "bronze",
    icon_url: null,
    is_enabled: true,
    display_order: 30,
  },
  {
    name: "Well Connected",
    description: "Built a network of 5 alumni connections.",
    category: "series",
    series_type: "connection",
    required_score: 5,
    tier: "silver",
    icon_url: null,
    is_enabled: true,
    display_order: 31,
  },
  {
    name: "Super Connector",
    description: "An impressive network of 15+ alumni connections!",
    category: "series",
    series_type: "connection",
    required_score: 15,
    tier: "gold",
    icon_url: null,
    is_enabled: true,
    display_order: 32,
  },
];

async function seed() {
  console.log("Seeding gamification badges...");

  // Check if badges already exist
  const { data: existing, error: checkErr } = await supabase
    .from("gamification_badges")
    .select("id")
    .limit(1);

  if (checkErr) {
    console.error("Error checking existing badges:", checkErr);
    process.exit(1);
  }

  if (existing && existing.length > 0) {
    console.log("Badges already exist. Skipping seed.");
    process.exit(0);
  }

  const { data, error } = await supabase
    .from("gamification_badges")
    .insert(defaultBadges)
    .select("id, name, category, series_type, tier");

  if (error) {
    console.error("Error seeding badges:", error);
    process.exit(1);
  }

  console.log(`Successfully seeded ${data.length} badges:`);
  data.forEach((b: any) => {
    console.log(`  ✅ ${b.name} (${b.category}/${b.series_type}, tier: ${b.tier})`);
  });

  process.exit(0);
}

seed();
