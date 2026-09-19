/**
 * Met Subject Museum ingest (assessment API slice).
 * Searches Met /v1.1 for launch tags, fetches objects, upserts artworks + terms.
 *
 * For full Open Access catalog: npm run ingest:csv
 *
 * Usage: npm run ingest
 */
import { createClient } from "@supabase/supabase-js";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import {
  normalizeMetObject,
  type MetObjectApi,
} from "../../src/lib/index/normalize";
import {
  rebuildTermsAndLinks,
  startIngestionRun,
  upsertArtworks,
} from "./upsert-index";

config({ path: ".env.local" });

const MET = "https://collectionapi.metmuseum.org";
const DATA = path.resolve(process.cwd(), "data/met");
const PER_QUERY = Number(process.env.MET_INGEST_LIMIT ?? "80");
const QUERIES = (
  process.env.MET_INGEST_QUERIES ?? "flower,landscape,animal,bird,horse,tree,water"
).split(",").map((s) => s.trim()).filter(Boolean);

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

async function main() {
  await mkdir(DATA, { recursive: true });
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const idsByQuery = new Map<string, number[]>();
  const objectIds = new Set<number>();

  for (const q of QUERIES) {
    const searchUrl = `${MET}/public/collection/v1.1/search?q=${encodeURIComponent(q)}&hasImages=true&isPublicDomain=true&limit=${PER_QUERY}`;
    console.log("search", q);
    const json = await fetchJson<{ objectIDs: number[] | null }>(searchUrl);
    if (!json) throw new Error(`Search failed for ${q}`);
    const ids = json.objectIDs ?? [];
    idsByQuery.set(q, ids);
    for (const id of ids) objectIds.add(id);
    await sleep(200);
  }
  console.log(`Unique object IDs: ${objectIds.size}`);

  let i = 0;
  const byId = new Map<string, NonNullable<ReturnType<typeof normalizeMetObject>>>();
  for (const id of objectIds) {
    i++;
    if (i % 25 === 0) console.log(`fetch objects ${i}/${objectIds.size}`);
    const obj = await fetchJson<MetObjectApi>(
      `${MET}/public/collection/v1/objects/${id}`,
    );
    if (!obj) {
      await sleep(100);
      continue;
    }
    const norm = normalizeMetObject(obj);
    if (norm && norm.is_public_domain && (norm.image_url || norm.image_url_small)) {
      byId.set(norm.source_id, norm);
    }
    await sleep(120);
  }

  for (const [q, ids] of idsByQuery) {
    for (const id of ids) {
      const norm = byId.get(String(id));
      if (!norm) continue;
      if (!norm.subject_titles.map((t) => t.toLowerCase()).includes(q)) {
        norm.subject_titles = [...norm.subject_titles, q];
      }
    }
  }

  const artworks = [...byId.values()];
  console.log(`Normalized PD artworks: ${artworks.length}`);
  if (!artworks.length) throw new Error("No artworks ingested");

  const runId = await startIngestionRun(supabase, {
    source_version: "api-v1.1-slice",
    notes: `queries=${QUERIES.join(",")}; objects=${artworks.length}`,
  });
  await upsertArtworks(supabase, artworks);
  console.log("Upserted artworks");

  const rebuilt = await rebuildTermsAndLinks(supabase, artworks);
  await writeFile(
    path.join(DATA, "ingest-summary.json"),
    JSON.stringify(
      {
        runId,
        artworks: artworks.length,
        terms: rebuilt.terms,
        journey_ready: rebuilt.journey_ready,
        journey_ready_count: rebuilt.journey_ready.length,
      },
      null,
      2,
    ),
  );
  console.log(
    `Done. journey_ready=${rebuilt.journey_ready.length}`,
    rebuilt.journey_ready.slice(0, 15),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
