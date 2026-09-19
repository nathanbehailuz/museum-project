/**
 * Phase 1 ingest:
 * 1. Load AIC getting-started ID universe (someArtworks + optional jsonl sample)
 * 2. Enrich from live API (subject_titles, term_titles, PD, image, dates)
 * 3. Upsert artworks + terms + artwork_terms; validate term status
 * 4. Record ingestion_runs
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { createClient } from "@supabase/supabase-js";
import { createReadStream } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import readline from "node:readline";
import { config } from "dotenv";
import {
  extractCatalogTermLinks,
  isLanguageRejected,
  normalizeArtwork,
  normalizeTermLabel,
  slugifyTerm,
} from "../../src/lib/aic/normalize";
import type { ArticArtworkApi, NormalizedArtwork } from "../../src/lib/aic/types";
import { ARTIC_FIELDS } from "../../src/lib/aic/types";
import {
  type TermAggregate,
  validateTerm,
} from "../../src/lib/aic/validate";

config({ path: ".env.local" });

const DATA = path.resolve(process.cwd(), "data/aic");
const ARTIC = "https://api.artic.edu/api/v1/artworks";
const UA = "museum-exhibition/0.1 (Phase1 ingest; +https://github.com/)";

const EXTRA_JSONL_IDS = Number(process.env.INGEST_EXTRA_JSONL_IDS ?? "1500");
const BATCH = 40;
const BATCH_PAUSE_MS = 1100;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadSomeArtworkIds(): Promise<number[]> {
  const csv = await readFile(path.join(DATA, "someArtworks.csv"), "utf8");
  const ids: number[] = [];
  for (const line of csv.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const id = Number(line.split(",")[0]);
    if (Number.isFinite(id)) ids.push(id);
  }
  return ids;
}

async function loadExtraJsonlIds(limit: number, exclude: Set<number>) {
  const ids: number[] = [];
  const rl = readline.createInterface({
    input: createReadStream(path.join(DATA, "allArtworks.jsonl")),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (ids.length >= limit) break;
    if (!line.trim()) continue;
    try {
      const row = JSON.parse(line) as { id?: number };
      if (row.id != null && !exclude.has(row.id)) ids.push(row.id);
    } catch {
      /* skip */
    }
  }
  return ids;
}

async function enrichIds(ids: number[]): Promise<ArticArtworkApi[]> {
  const out: ArticArtworkApi[] = [];
  for (let i = 0; i < ids.length; i += BATCH) {
    const chunk = ids.slice(i, i + BATCH);
    const url = `${ARTIC}?ids=${chunk.join(",")}&limit=${chunk.length}&fields=${ARTIC_FIELDS}`;
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) {
      throw new Error(`AIC enrich failed ${res.status}: ${await res.text()}`);
    }
    const json = (await res.json()) as { data: ArticArtworkApi[] };
    out.push(...(json.data ?? []));
    console.log(`Enriched ${Math.min(i + BATCH, ids.length)} / ${ids.length}`);
    if (i + BATCH < ids.length) await sleep(BATCH_PAUSE_MS);
  }
  return out;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} — copy .env.example to .env.local`);
  return v;
}

async function loadOrEnrichArtworks(): Promise<NormalizedArtwork[]> {
  const cachePath = path.join(DATA, "enriched-cache.json");
  if (process.env.INGEST_USE_CACHE === "1") {
    const raw = await readFile(cachePath, "utf8");
    console.log(`Using cache ${cachePath}`);
    return JSON.parse(raw) as NormalizedArtwork[];
  }

  const someIds = await loadSomeArtworkIds();
  const exclude = new Set(someIds);
  const extra = await loadExtraJsonlIds(EXTRA_JSONL_IDS, exclude);
  const allIds = [...someIds, ...extra];
  console.log(
    `ID universe: ${someIds.length} someArtworks + ${extra.length} jsonl = ${allIds.length}`,
  );

  const apiRows = await enrichIds(allIds);
  const artworks = apiRows.map(normalizeArtwork);
  await mkdir(DATA, { recursive: true });
  await writeFile(cachePath, JSON.stringify(artworks), "utf8");
  console.log(`Wrote ${cachePath} (${artworks.length} artworks)`);
  return artworks;
}

async function main() {
  const artworks = await loadOrEnrichArtworks();

  if (process.env.INGEST_ENRICH_ONLY === "1") {
    console.log("INGEST_ENRICH_ONLY=1 — skipping Supabase upsert");
    return;
  }

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: runRow, error: runErr } = await supabase
    .from("ingestion_runs")
    .insert({
      source: "artic",
      source_version: "getting-started+live-enrich",
      notes: `artworks=${artworks.length}`,
    })
    .select("id")
    .single();
  if (runErr) throw runErr;
  const runId = runRow.id as string;

  // Upsert artworks
  const artworkPayload = artworks.map((a) => ({
    source: a.source,
    source_id: a.source_id,
    title: a.title,
    artist_title: a.artist_title,
    date_start: a.date_start,
    date_end: a.date_end,
    date_display: a.date_display,
    medium_display: a.medium_display,
    artwork_type_title: a.artwork_type_title,
    image_id: a.image_id,
    image_width: a.image_width,
    image_height: a.image_height,
    alt_text: a.alt_text,
    is_public_domain: a.is_public_domain,
    source_url: a.source_url,
    subject_titles: a.subject_titles,
    term_titles: a.term_titles,
    raw_department: a.raw_department,
  }));

  for (let i = 0; i < artworkPayload.length; i += 200) {
    const chunk = artworkPayload.slice(i, i + 200);
    const { error } = await supabase.from("artworks").upsert(chunk, {
      onConflict: "source,source_id",
    });
    if (error) throw error;
  }
  console.log(`Upserted ${artworkPayload.length} artworks`);

  const { data: dbArtworks, error: fetchArtErr } = await supabase
    .from("artworks")
    .select("id, source_id")
    .eq("source", "artic")
    .in(
      "source_id",
      artworks.map((a) => a.source_id),
    );
  if (fetchArtErr) throw fetchArtErr;
  const idBySource = new Map(
    (dbArtworks ?? []).map((r) => [r.source_id as string, r.id as string]),
  );

  // Build term aggregates from catalog evidence only
  const byCanonical = new Map<string, TermAggregate & { links: ReturnType<typeof extractCatalogTermLinks> }>();
  for (const a of artworks) {
    const links = extractCatalogTermLinks(a);
    for (const link of links) {
      if (isLanguageRejected(link.canonical)) continue;
      let agg = byCanonical.get(link.canonical);
      if (!agg) {
        agg = {
          canonical: link.canonical,
          display_label: link.display_label,
          artworks: [],
          links: [],
        };
        byCanonical.set(link.canonical, agg);
      }
      if (!agg.artworks.some((x) => x.source_id === a.source_id)) {
        agg.artworks.push(a);
      }
      agg.links.push(link);
    }
  }

  const validations = [...byCanonical.values()].map((agg) => ({
    agg,
    v: validateTerm(agg),
  }));

  const termRows = validations.map(({ agg, v }) => ({
    slug: slugifyTerm(agg.canonical),
    canonical: agg.canonical,
    display_label: agg.display_label,
    aliases:
      normalizeTermLabel(agg.canonical + "s") === agg.canonical
        ? []
        : [`${agg.canonical}s`],
    status: v.status,
    qualifying_work_count: v.qualifying_work_count,
    date_min: v.date_min,
    date_max: v.date_max,
    artist_count: v.artist_count,
    artwork_type_count: v.artwork_type_count,
    medium_count: v.medium_count,
    max_artist_share: v.max_artist_share,
    year_span: v.year_span,
    bucket_count: v.bucket_count,
    validation_reasons: v.reasons,
  }));

  for (let i = 0; i < termRows.length; i += 200) {
    const chunk = termRows.slice(i, i + 200);
    const { error } = await supabase.from("terms").upsert(chunk, {
      onConflict: "slug",
    });
    if (error) throw error;
  }
  console.log(`Upserted ${termRows.length} terms`);

  const { data: dbTerms, error: termFetchErr } = await supabase
    .from("terms")
    .select("id, canonical, status");
  if (termFetchErr) throw termFetchErr;
  const termIdByCanonical = new Map(
    (dbTerms ?? []).map((t) => [t.canonical as string, t.id as string]),
  );

  // Replace artwork_terms for these artworks (delete then insert)
  const artworkUuids = [...idBySource.values()];
  for (let i = 0; i < artworkUuids.length; i += 200) {
    const chunk = artworkUuids.slice(i, i + 200);
    const { error } = await supabase
      .from("artwork_terms")
      .delete()
      .in("artwork_id", chunk);
    if (error) throw error;
  }

  const atRows: {
    artwork_id: string;
    term_id: string;
    evidence_source: string;
    relevance_weight: number;
  }[] = [];
  for (const { agg } of validations) {
    const termId = termIdByCanonical.get(agg.canonical);
    if (!termId) continue;
    const seen = new Set<string>();
    for (const link of agg.links) {
      const artworkId = idBySource.get(link.source_id);
      if (!artworkId) continue;
      const key = `${artworkId}:${termId}:${link.evidence_source}`;
      if (seen.has(key)) continue;
      seen.add(key);
      atRows.push({
        artwork_id: artworkId,
        term_id: termId,
        evidence_source: link.evidence_source,
        relevance_weight: link.relevance_weight,
      });
    }
  }

  for (let i = 0; i < atRows.length; i += 500) {
    const chunk = atRows.slice(i, i + 500);
    const { error } = await supabase.from("artwork_terms").insert(chunk);
    if (error) throw error;
  }
  console.log(`Inserted ${atRows.length} artwork_terms`);

  const journey = validations.filter((x) => x.v.status === "journey_ready");
  const browse = validations.filter((x) => x.v.status === "browse_only");
  const unavailable = validations.filter((x) => x.v.status === "unavailable");

  await supabase
    .from("ingestion_runs")
    .update({
      finished_at: new Date().toISOString(),
      artworks_upserted: artworks.length,
      terms_upserted: termRows.length,
      artwork_terms_upserted: atRows.length,
      rejected_term_count: unavailable.length,
      journey_ready_count: journey.length,
      browse_only_count: browse.length,
      unavailable_count: unavailable.length,
    })
    .eq("id", runId);

  const summary = {
    runId,
    artworks: artworks.length,
    terms: termRows.length,
    journey_ready: journey
      .sort((a, b) => b.v.qualifying_work_count - a.v.qualifying_work_count)
      .slice(0, 20)
      .map((x) => ({
        canonical: x.agg.canonical,
        works: x.v.qualifying_work_count,
        span: x.v.year_span,
        artists: x.v.artist_count,
      })),
    browse_only_top: browse
      .sort((a, b) => b.v.qualifying_work_count - a.v.qualifying_work_count)
      .slice(0, 10)
      .map((x) => ({
        canonical: x.agg.canonical,
        works: x.v.qualifying_work_count,
        reasons: x.v.reasons,
      })),
  };
  await writeFile(
    path.join(DATA, "ingest-summary.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
