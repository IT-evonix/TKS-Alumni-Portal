import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const defaultBadges = [
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
    name: "First Event",
    description: "Attended your first alumni event. Thanks for joining!",
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
    name: "First Connection",
    description: "Made your first connection with a fellow alumni.",
    category: "series",
    series_type: "connection",
    required_score: 1,
    tier: "bronze",
    icon_url: null,
    is_enabled: true,
    display_order: 30,
    
  },
  {
    name: "Networker",
    description: "Connected with 10 alumni. Growing your network!",
    category: "series",
    series_type: "connection",
    required_score: 10,
    tier: "silver",
    icon_url: null,
    is_enabled: true,
    display_order: 31,
    
  },
  {
    name: "Super Connector",
    description: "Connected with 50+ alumni. You know everyone!",
    category: "series",
    series_type: "connection",
    required_score: 50,
    tier: "gold",
    icon_url: null,
    is_enabled: true,
    display_order: 32,
    
  }
];

async function seed() {
  const { data: existing } = await supabase.from("gamification_badges").select("name");
  const existingNames = new Set((existing || []).map(e => e.name));

  const toInsert = defaultBadges.filter(b => !existingNames.has(b.name));

  if (toInsert.length > 0) {
    console.log(`Inserting ${toInsert.length} missing badges...`);
    const { error } = await supabase.from("gamification_badges").insert(toInsert);
    if (error) console.error("Error inserting badges:", error);
    else console.log("Done inserting missing badges.");
  } else {
    console.log("All badges already exist.");
  }
}

seed().catch(console.error);
