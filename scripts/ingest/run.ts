/**
 * Met Subject Museum ingest (assessment slice).
 * Searches Met /v1.1 for launch tags, fetches objects, upserts artworks + terms.
 *
 * image_id column stores the JPEG URL (Met primaryImageSmall) until image_url
 * migration is applied. See supabase/migrations/20260919140000_met_pivot.sql
 *
 * Usage: npm run ingest
 */
import { createClient } from "@supabase/supabase-js";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import {
  extractCatalogTermLinks,
  isDisplayableArtwork,
  normalizeMetObject,
  slugifyTerm,
  type MetObjectApi,
} from "../../src/lib/index/normalize";
import { validateTerm, type TermAggregate } from "../../src/lib/index/validate";

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

  const artworks = [];
  /** source_id -> search queries that found it */
  const foundBy = new Map<string, Set<string>>();
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
  const byId = new Map<string, ReturnType<typeof normalizeMetObject>>();
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

  // Attach launch query as a tag so search hits become subject terms
  for (const [q, ids] of idsByQuery) {
    for (const id of ids) {
      const norm = byId.get(String(id));
      if (!norm) continue;
      if (!norm.subject_titles.map((t) => t.toLowerCase()).includes(q)) {
        norm.subject_titles = [...norm.subject_titles, q];
      }
      const set = foundBy.get(norm.source_id) ?? new Set();
      set.add(q);
      foundBy.set(norm.source_id, set);
    }
  }

  for (const norm of byId.values()) artworks.push(norm!);
  console.log(`Normalized PD artworks: ${artworks.length}`);
  if (!artworks.length) throw new Error("No artworks ingested");

  const { data: runRow, error: runErr } = await supabase
    .from("ingestion_runs")
    .insert({
      source: "met",
      source_version: "api-v1.1-slice",
      notes: `queries=${QUERIES.join(",")}; objects=${artworks.length}`,
    })
    .select("id")
    .single();
  if (runErr) throw runErr;

  // Upsert artworks — JPEG URL in image_id for compatibility without DDL
  const artworkPayload = artworks.map((a) => ({
    source: "met",
    source_id: a.source_id,
    title: a.title,
    artist_title: a.artist_title,
    date_start: a.date_start,
    date_end: a.date_end,
    date_display: a.date_display,
    medium_display: a.medium_display,
    artwork_type_title: a.artwork_type_title,
    image_id: a.image_url_small || a.image_url,
    image_width: a.image_width,
    image_height: a.image_height,
    alt_text: a.alt_text,
    is_public_domain: a.is_public_domain,
    source_url: a.source_url,
    subject_titles: a.subject_titles,
    term_titles: a.term_titles,
    raw_department: a.raw_department,
    updated_at: new Date().toISOString(),
  }));

  for (let i = 0; i < artworkPayload.length; i += 100) {
    const chunk = artworkPayload.slice(i, i + 100);
    const { error } = await supabase.from("artworks").upsert(chunk, {
      onConflict: "source,source_id",
    });
    if (error) throw error;
  }
  console.log("Upserted artworks");

  const { data: artRows, error: artErr } = await supabase
    .from("artworks")
    .select("id, source_id")
    .eq("source", "met");
  if (artErr) throw artErr;
  const idBySource = new Map(
    (artRows ?? []).map((r) => [r.source_id as string, r.id as string]),
  );

  // Aggregate terms
  const byCanonical = new Map<string, TermAggregate & { links: ReturnType<typeof extractCatalogTermLinks> }>();
  for (const a of artworks) {
    if (!isDisplayableArtwork(a) && !(a.is_public_domain && a.date_start != null && (a.image_url || a.image_url_small))) {
      // still index tags for PD dated works with images
    }
    const links = extractCatalogTermLinks(a);
    for (const link of links) {
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

  const termPayload = [];
  const validations = [];
  for (const agg of byCanonical.values()) {
    const v = validateTerm(agg);
    validations.push(v);
    termPayload.push({
      slug: slugifyTerm(agg.canonical),
      canonical: agg.canonical,
      display_label: agg.display_label,
      aliases: [] as string[],
      status: v.status,
      qualifying_work_count: v.qualifying_work_count,
      date_min: v.date_min,
      date_max: v.date_max,
      year_span: v.year_span,
      bucket_count: v.bucket_count,
      artist_count: v.artist_count,
      artwork_type_count: v.artwork_type_count,
      medium_count: v.medium_count,
      max_artist_share: v.max_artist_share,
      validation_reasons: v.reasons,
      updated_at: new Date().toISOString(),
    });
  }

  for (let i = 0; i < termPayload.length; i += 100) {
    const { error } = await supabase.from("terms").upsert(termPayload.slice(i, i + 100), {
      onConflict: "slug",
    });
    if (error) throw error;
  }
  console.log(`Upserted ${termPayload.length} terms`);

  const { data: termRows, error: termErr } = await supabase
    .from("terms")
    .select("id, canonical, slug");
  if (termErr) throw termErr;
  const termIdByCanonical = new Map(
    (termRows ?? []).map((t) => [t.canonical as string, t.id as string]),
  );

  // Clear old links then insert
  const artIds = [...idBySource.values()];
  for (let i = 0; i < artIds.length; i += 50) {
    await supabase
      .from("artwork_terms")
      .delete()
      .in("artwork_id", artIds.slice(i, i + 50));
  }

  const linkRows: Record<string, unknown>[] = [];
  for (const a of artworks) {
    const artworkId = idBySource.get(a.source_id);
    if (!artworkId) continue;
    for (const link of extractCatalogTermLinks(a)) {
      const termId = termIdByCanonical.get(link.canonical);
      if (!termId) continue;
      linkRows.push({
        artwork_id: artworkId,
        term_id: termId,
        evidence_source: "term", // enum may lack 'tag' until migration; 'term' = Met tag
        relevance_weight: link.relevance_weight,
      });
    }
  }
  // dedupe
  const seen = new Set<string>();
  const uniqueLinks = linkRows.filter((r) => {
    const k = `${r.artwork_id}:${r.term_id}:${r.evidence_source}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  for (let i = 0; i < uniqueLinks.length; i += 200) {
    const { error } = await supabase.from("artwork_terms").upsert(uniqueLinks.slice(i, i + 200));
    if (error) throw error;
  }
  console.log(`Upserted ${uniqueLinks.length} artwork_terms`);

  const journey = validations.filter((v) => v.status === "journey_ready");
  await writeFile(
    path.join(DATA, "ingest-summary.json"),
    JSON.stringify(
      {
        runId: runRow.id,
        artworks: artworks.length,
        terms: termPayload.length,
        journey_ready: journey.map((j) => j.canonical),
        journey_ready_count: journey.length,
      },
      null,
      2,
    ),
  );
  console.log(
    `Done. journey_ready=${journey.length}`,
    journey.slice(0, 15).map((j) => j.canonical),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
