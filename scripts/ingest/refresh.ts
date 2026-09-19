/**
 * Soft refresh: re-fetch Met /v1/objects for existing index rows and upsert metadata + image URLs.
 * Does not rebuild terms/artwork_terms — run `npm run ingest:connections` after.
 *
 * Usage: npm run ingest:refresh
 */
import { createClient } from "@supabase/supabase-js";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import {
  normalizeMetObject,
  type MetObjectApi,
} from "../../src/lib/index/normalize";

config({ path: ".env.local" });

const MET = "https://collectionapi.metmuseum.org";
const DATA = path.resolve(process.cwd(), "data/met");
const PAGE = 1000;

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson<T>(url: string, attempts = 4): Promise<T | null> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "museum-exhibition-met-ingest/1.0" },
        signal: AbortSignal.timeout(45_000),
      });
      if (res.status === 404 || res.status === 403) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      lastErr = err;
      await sleep(500 * (i + 1));
    }
  }
  console.warn("give up", url, lastErr);
  return null;
}

async function fetchAllSourceIds(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<string[]> {
  const ids: string[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("artworks")
      .select("source_id")
      .eq("source", "met")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as { source_id: string }[];
    ids.push(...batch.map((r) => r.source_id));
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return ids;
}

async function main() {
  await mkdir(DATA, { recursive: true });
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const sourceIds = await fetchAllSourceIds(supabase);
  console.log(`Refreshing ${sourceIds.length} Met artworks`);
  if (!sourceIds.length) throw new Error("No Met artworks to refresh");

  const { data: runRow, error: runErr } = await supabase
    .from("ingestion_runs")
    .insert({
      source: "met",
      source_version: "api-v1-refresh",
      notes: `refresh existing objects=${sourceIds.length}`,
    })
    .select("id")
    .single();
  if (runErr) throw runErr;

  let updated = 0;
  let skipped = 0;
  let fetchFailed = 0;
  const payload: Record<string, unknown>[] = [];

  for (let i = 0; i < sourceIds.length; i++) {
    const sourceId = sourceIds[i]!;
    if ((i + 1) % 25 === 0) {
      console.log(`fetch objects ${i + 1}/${sourceIds.length}`);
    }
    const obj = await fetchJson<MetObjectApi>(
      `${MET}/public/collection/v1/objects/${sourceId}`,
    );
    if (!obj) {
      fetchFailed++;
      await sleep(100);
      continue;
    }
    const norm = normalizeMetObject(obj);
    if (
      !norm ||
      !norm.is_public_domain ||
      !(norm.image_url || norm.image_url_small)
    ) {
      skipped++;
      await sleep(120);
      continue;
    }
    payload.push({
      source: "met",
      source_id: norm.source_id,
      title: norm.title,
      artist_title: norm.artist_title,
      date_start: norm.date_start,
      date_end: norm.date_end,
      date_display: norm.date_display,
      medium_display: norm.medium_display,
      artwork_type_title: norm.artwork_type_title,
      image_url: norm.image_url,
      image_url_small: norm.image_url_small,
      image_id: norm.image_url_small || norm.image_url,
      image_width: norm.image_width,
      image_height: norm.image_height,
      alt_text: norm.alt_text,
      is_public_domain: norm.is_public_domain,
      source_url: norm.source_url,
      subject_titles: norm.subject_titles,
      term_titles: norm.term_titles,
      raw_department: norm.raw_department,
      updated_at: new Date().toISOString(),
    });
    updated++;
    await sleep(120);
  }

  for (let i = 0; i < payload.length; i += 100) {
    const chunk = payload.slice(i, i + 100);
    const { error } = await supabase.from("artworks").upsert(chunk, {
      onConflict: "source,source_id",
    });
    if (error) throw error;
  }

  const summary = {
    runId: runRow.id,
    total: sourceIds.length,
    updated,
    skipped,
    fetchFailed,
  };
  await writeFile(
    path.join(DATA, "refresh-summary.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log("Done.", summary);
  console.log("Next: npm run ingest:connections");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
