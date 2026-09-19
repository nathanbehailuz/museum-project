/**
 * THROWAWAY Met POC — fetch a few PD works and upsert into `artworks` (source=met).
 * Stores the Met JPEG URL in `image_id` (reuse column; not an AIC IIIF id).
 *
 * Usage: npx tsx scripts/poc/met-seed.ts
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (.env.local)
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const MET_BASE = "https://collectionapi.metmuseum.org";
const LIMIT = Number(process.env.MET_POC_LIMIT ?? "9");

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

type MetObject = {
  objectID: number;
  title?: string;
  artistDisplayName?: string;
  objectDate?: string;
  medium?: string;
  primaryImage?: string;
  primaryImageSmall?: string;
  isPublicDomain?: boolean;
  objectURL?: string;
};

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const searchUrl = `${MET_BASE}/public/collection/v1.1/search?q=flower&hasImages=true&isPublicDomain=true&limit=${LIMIT}`;
  console.log("Search", searchUrl);
  const searchRes = await fetch(searchUrl, {
    headers: { "User-Agent": "museum-exhibition-met-poc/0.1" },
  });
  if (!searchRes.ok) throw new Error(`Search HTTP ${searchRes.status}`);
  const searchJson = (await searchRes.json()) as {
    total: number;
    objectIDs: number[] | null;
  };
  const ids = (searchJson.objectIDs ?? []).slice(0, LIMIT);
  console.log(`Search total=${searchJson.total}, fetching ${ids.length} objects`);

  const rows: Record<string, unknown>[] = [];
  for (const id of ids) {
    const res = await fetch(`${MET_BASE}/public/collection/v1/objects/${id}`, {
      headers: { "User-Agent": "museum-exhibition-met-poc/0.1" },
    });
    if (!res.ok) {
      console.warn(`skip ${id}: HTTP ${res.status}`);
      continue;
    }
    const obj = (await res.json()) as MetObject;
    if (!obj.isPublicDomain || !obj.primaryImage) {
      console.warn(`skip ${id}: not PD or no image`);
      continue;
    }
    const imageUrl = obj.primaryImageSmall || obj.primaryImage;
    rows.push({
      source: "met",
      source_id: String(obj.objectID),
      title: obj.title ?? null,
      artist_title: obj.artistDisplayName || null,
      date_display: obj.objectDate ?? null,
      medium_display: obj.medium ?? null,
      // POC: store direct JPEG URL here (Met images.metmuseum.org)
      image_id: imageUrl,
      is_public_domain: true,
      source_url:
        obj.objectURL ??
        `https://www.metmuseum.org/art/collection/search/${obj.objectID}`,
      updated_at: new Date().toISOString(),
    });
    console.log(`ok ${id} ${obj.title}`);
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!rows.length) throw new Error("No rows to upsert");

  const { error } = await supabase.from("artworks").upsert(rows, {
    onConflict: "source,source_id",
  });
  if (error) throw error;
  console.log(`Upserted ${rows.length} Met rows into artworks (source=met)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
