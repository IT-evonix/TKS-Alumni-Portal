import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl) {
  console.error("Missing supabaseUrl");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedCompetitiveBadges() {
  const badges = [
    {
      name: "Event Master",
      description: "Highest event participation! Held by the #1 Event Explorer.",
      category: "competitive",
      series_type: "event",
      required_score: 0,
      tier: "platinum",
      icon_url: null,
      is_enabled: true,
      display_order: 100,
    },
    {
      name: "Top Contributor",
      description: "Highest comments and replies! The reigning Community Voice.",
      category: "competitive",
      series_type: "thread",
      required_score: 0,
      tier: "platinum",
      icon_url: null,
      is_enabled: true,
      display_order: 101,
    }
  ];

  for (const b of badges) {
    const { data: existing } = await supabase
      .from('gamification_badges')
      .select('id')
      .eq('name', b.name)
      .maybeSingle();

    if (!existing) {
      console.log(`Inserting badge: ${b.name}`);
      const { error } = await supabase.from('gamification_badges').insert(b);
      if (error) console.error("Error inserting:", error);
    } else {
      console.log(`Badge ${b.name} already exists. Updating it...`);
      const { error } = await supabase.from('gamification_badges').update(b).eq('name', b.name);
      if (error) console.error("Error updating:", error);
    }
  }
  console.log("Done!");
}

seedCompetitiveBadges();
