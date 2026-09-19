/**
 * Load enriched-cache.json into Supabase using the service role client,
 * or print batch payloads for MCP execute_sql when SERVICE_ROLE is unset.
 */
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import {
  extractCatalogTermLinks,
  isLanguageRejected,
  normalizeTermLabel,
  slugifyTerm,
} from "../../src/lib/aic/normalize";
import type { NormalizedArtwork } from "../../src/lib/aic/types";
import { type TermAggregate, validateTerm } from "../../src/lib/aic/validate";

config({ path: ".env.local" });
config();

const DATA = path.resolve(process.cwd(), "data/aic");

async function main() {
  const artworks = JSON.parse(
    await readFile(path.join(DATA, "enriched-cache.json"), "utf8"),
  ) as NormalizedArtwork[];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: runRow, error: runErr } = await supabase
    .from("ingestion_runs")
    .insert({
      source: "artic",
      source_version: "getting-started+live-enrich",
      notes: `cache_load artworks=${artworks.length}`,
    })
    .select("id")
    .single();
  if (runErr) throw runErr;
  const runId = runRow.id as string;

  for (let i = 0; i < artworks.length; i += 100) {
    const chunk = artworks.slice(i, i + 100);
    const { error } = await supabase.rpc("ingest_upsert_artworks", {
      rows: chunk,
    });
    if (error) {
      // fallback upsert
      const payload = chunk.map((a) => ({
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
      const { error: upErr } = await supabase.from("artworks").upsert(payload, {
        onConflict: "source,source_id",
      });
      if (upErr) throw upErr;
    }
    console.log(`artworks ${Math.min(i + 100, artworks.length)}/${artworks.length}`);
  }

  const { data: dbArtworks, error: fetchArtErr } = await supabase
    .from("artworks")
    .select("id, source_id")
    .eq("source", "artic");
  if (fetchArtErr) throw fetchArtErr;
  const idBySource = new Map(
    (dbArtworks ?? []).map((r) => [r.source_id as string, r.id as string]),
  );

  const byCanonical = new Map<
    string,
    TermAggregate & { links: ReturnType<typeof extractCatalogTermLinks> }
  >();
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
      normalizeTermLabel(`${agg.canonical}s`) === agg.canonical
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
    const { error } = await supabase
      .from("terms")
      .upsert(termRows.slice(i, i + 200), { onConflict: "slug" });
    if (error) throw error;
  }
  console.log(`terms ${termRows.length}`);

  const { data: dbTerms, error: termFetchErr } = await supabase
    .from("terms")
    .select("id, canonical, status");
  if (termFetchErr) throw termFetchErr;
  const termIdByCanonical = new Map(
    (dbTerms ?? []).map((t) => [t.canonical as string, t.id as string]),
  );

  const artworkUuids = artworks
    .map((a) => idBySource.get(a.source_id))
    .filter((x): x is string => !!x);
  for (let i = 0; i < artworkUuids.length; i += 200) {
    await supabase
      .from("artwork_terms")
      .delete()
      .in("artwork_id", artworkUuids.slice(i, i + 200));
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
    const { error } = await supabase
      .from("artwork_terms")
      .insert(atRows.slice(i, i + 500));
    if (error) throw error;
  }

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
      .slice(0, 25)
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

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
