/**
 * Download AIC IIIF JPEGs (843px, AIC-recommended) and upload to Supabase
 * Storage bucket `iiif` as `{imageId}/843.jpg`.
 *
 * AIC scrape guidelines: one at a time, ~1s delay, /full/843,/0/default.jpg
 *
 * Usage: npm run ingest:images
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const WIDTH = 843;
const DELAY_MS = 1000;
const PAGE_SIZE = 1000;

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function iiifUrl(imageId: string) {
  return `https://www.artic.edu/iiif/2/${imageId}/full/${WIDTH},/0/default.jpg`;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureBucket(supabase: SupabaseClient) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  if (!(buckets ?? []).some((b) => b.name === "iiif")) {
    const { error: createErr } = await supabase.storage.createBucket("iiif", {
      public: true,
      fileSizeLimit: 8_000_000,
    });
    if (createErr) throw createErr;
    console.log("Created public bucket iiif");
  }
}

async function listImageIds(supabase: SupabaseClient): Promise<string[]> {
  const ids = new Set<string>();
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("artworks")
      .select("image_id")
      .not("image_id", "is", null)
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = data ?? [];
    for (const row of rows) {
      if (row.image_id) ids.add(row.image_id as string);
    }
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return [...ids];
}

async function objectExists(
  supabase: SupabaseClient,
  imageId: string,
): Promise<boolean> {
  const { data, error } = await supabase.storage.from("iiif").list(imageId, {
    limit: 20,
  });
  if (error) return false;
  return (data ?? []).some((f) => f.name === `${WIDTH}.jpg`);
}

async function main() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await ensureBucket(supabase);
  const imageIds = await listImageIds(supabase);
  console.log(`Found ${imageIds.length} unique image_id values`);

  let ok = 0;
  let skip = 0;
  let fail = 0;
  let uploaded = 0;

  for (let i = 0; i < imageIds.length; i++) {
    const imageId = imageIds[i];
    const path = `${imageId}/${WIDTH}.jpg`;
    const progress = `[${i + 1}/${imageIds.length}]`;

    if (await objectExists(supabase, imageId)) {
      console.log(`${progress} skip ${imageId}`);
      skip++;
      ok++;
      continue;
    }

    try {
      const res = await fetch(iiifUrl(imageId), {
        headers: {
          Accept: "image/jpeg,image/*;q=0.8,*/*;q=0.5",
          "User-Agent": "SubjectMuseum-image-mirror/1.0 (GitHub Actions; AIC scrape guidelines)",
        },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.startsWith("image/")) {
        throw new Error(`not image: ${ct}`);
      }
      const body = Buffer.from(await res.arrayBuffer());
      const { error: upErr } = await supabase.storage
        .from("iiif")
        .upload(path, body, {
          contentType: "image/jpeg",
          upsert: true,
        });
      if (upErr) throw upErr;
      console.log(`${progress} ok ${imageId} (${body.length} bytes)`);
      ok++;
      uploaded++;
    } catch (err) {
      console.error(`${progress} fail ${imageId}`, err);
      fail++;
    }

    await sleep(DELAY_MS);
  }

  console.log(`Done. ok=${ok} uploaded=${uploaded} skip=${skip} fail=${fail}`);
  if (uploaded === 0 && fail > 0 && skip === 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
