const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function test() {
  const { data, error } = await supabase
        .from("feed_posts")
        .insert({
          author_id: "daa75c2f-1f1a-4178-9101-f87d508854f4",
          content: "Test post from script",
          image_url: null,
          post_type: "general",
          likes_count: 0,
          comments_count: 0,
          shares_count: 0,
          is_active: true,
          status: "pending",
        })
        .select("*")
        .single();
  console.log("Error:", error);
}

test();
