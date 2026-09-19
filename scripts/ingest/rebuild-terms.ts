/** One-shot: rebuild terms + artwork_terms from Met artworks already in Supabase. */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { rebuildTermsAndLinks } from "./upsert-index";

config({ path: ".env.local" });

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function main() {
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const result = await rebuildTermsAndLinks(supabase);
  console.log({
    artworks: result.artworks,
    terms: result.terms,
    links: result.links,
    journey_ready_count: result.journey_ready.length,
    journey_ready_sample: result.journey_ready.slice(0, 25),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
