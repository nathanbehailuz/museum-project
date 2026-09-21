/**
 * On-demand Met enrich: serve the DB, fetch a small cap of missing objects, cache.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractCatalogTermLinks,
  normalizeMetObject,
  slugifyTerm,
  type MetObjectApi,
} from "./normalize";
import { computeTermPeriods } from "./periods";
import { validateTerm } from "./validate";
import { computeConnections, type ArtworkTermLink, type TermMeta } from "./connections";
import type { NormalizedArtwork } from "./types";
import {
  artworkWriteRow,
  CATALOG_EVIDENCE,
  ENRICH_FETCH_CAP,
  ENRICH_TARGET_CACHED,
  pickUncachedIds,
} from "./enrichIds";
import { createSupabaseAdminClient } from "../supabase/admin";

const MET = "https://collectionapi.metmuseum.org";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchMetObject(id: string): Promise<MetObjectApi | null> {
  try {
    const res = await fetch(`${MET}/public/collection/v1/objects/${id}`, {
      headers: {
        "User-Agent": "museum-exhibition-met-ingest/1.0 (educational; on-demand)",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (text.trimStart().startsWith("<")) return null;
    return JSON.parse(text) as MetObjectApi;
  } catch {
    return null;
  }
}

async function catalogIdsForSlug(
  supabase: SupabaseClient,
  slug: string,
  limit = 400,
): Promise<string[]> {
  const ids: string[] = [];
  let from = 0;
  const PAGE = 1000;
  while (ids.length < limit) {
    const to = from + PAGE - 1;
    const { data, error } = await supabase
      .from("object_tags")
      .select("source_id")
      .eq("slug", slug)
      .range(from, to);
    if (error) throw error;
    const batch = data ?? [];
    for (const row of batch) {
      ids.push(row.source_id as string);
      if (ids.length >= limit) break;
    }
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return ids;
}

async function cachedSourceIds(
  supabase: SupabaseClient,
  sourceIds: string[],
): Promise<Set<string>> {
  const cached = new Set<string>();
  for (let i = 0; i < sourceIds.length; i += 100) {
    const chunk = sourceIds.slice(i, i + 100);
    const { data, error } = await supabase
      .from("artworks")
      .select("source_id")
      .eq("source", "met")
      .in("source_id", chunk);
    if (error) throw error;
    for (const row of data ?? []) cached.add(row.source_id as string);
  }
  return cached;
}

async function upsertArtworks(
  supabase: SupabaseClient,
  artworks: NormalizedArtwork[],
) {
  const payload = artworks.map(artworkWriteRow);
  for (let i = 0; i < payload.length; i += 50) {
    const { error } = await supabase
      .from("artworks")
      .upsert(payload.slice(i, i + 50), { onConflict: "source,source_id" });
    if (error) throw error;
  }
}

async function linkNewArtworks(
  supabase: SupabaseClient,
  artworks: NormalizedArtwork[],
) {
  const { data: artRows, error: artErr } = await supabase
    .from("artworks")
    .select("id, source_id")
    .eq("source", "met")
    .in(
      "source_id",
      artworks.map((a) => a.source_id),
    );
  if (artErr) throw artErr;
  const idBySource = new Map(
    (artRows ?? []).map((r) => [r.source_id as string, r.id as string]),
  );

  const neededCanonical = new Set<string>();
  const linksByArtwork: { source_id: string; canonical: string; display_label: string }[] =
    [];
  for (const a of artworks) {
    for (const link of extractCatalogTermLinks(a)) {
      neededCanonical.add(link.canonical);
      linksByArtwork.push({
        source_id: a.source_id,
        canonical: link.canonical,
        display_label: link.display_label,
      });
    }
  }

  const termPayload = [...neededCanonical].map((canonical) => {
    const display =
      linksByArtwork.find((l) => l.canonical === canonical)?.display_label ??
      canonical;
    return {
      slug: slugifyTerm(canonical),
      canonical,
      display_label: display,
      updated_at: new Date().toISOString(),
    };
  });
  for (let i = 0; i < termPayload.length; i += 100) {
    const { error } = await supabase
      .from("terms")
      .upsert(termPayload.slice(i, i + 100), { onConflict: "slug" });
    if (error) throw error;
  }

  const { data: termRows, error: termErr } = await supabase
    .from("terms")
    .select("id, canonical")
    .in(
      "canonical",
      [...neededCanonical],
    );
  if (termErr) throw termErr;
  const termIdByCanonical = new Map(
    (termRows ?? []).map((t) => [t.canonical as string, t.id as string]),
  );

  const linkRows: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (const link of linksByArtwork) {
    const artworkId = idBySource.get(link.source_id);
    const termId = termIdByCanonical.get(link.canonical);
    if (!artworkId || !termId) continue;
    const k = `${artworkId}:${termId}:tag`;
    if (seen.has(k)) continue;
    seen.add(k);
    linkRows.push({
      artwork_id: artworkId,
      term_id: termId,
      evidence_source: "tag",
      relevance_weight: 1,
    });
  }
  for (let i = 0; i < linkRows.length; i += 200) {
    const { error } = await supabase
      .from("artwork_terms")
      .upsert(linkRows.slice(i, i + 200));
    if (error) throw error;
  }
}

type ArtRow = {
  id: string;
  source_id: string;
  title: string | null;
  artist_title: string | null;
  date_start: number | null;
  date_end: number | null;
  date_display: string | null;
  medium_display: string | null;
  artwork_type_title: string | null;
  image_url: string | null;
  image_url_small: string | null;
  image_id: string | null;
  is_public_domain: boolean;
  source_url: string;
  subject_titles: string[] | null;
  term_titles: string[] | null;
  raw_department: string | null;
  alt_text: string | null;
  image_width: number | null;
  image_height: number | null;
};

function rowToNorm(r: ArtRow): NormalizedArtwork {
  return {
    source: "met",
    source_id: r.source_id,
    title: r.title,
    artist_title: r.artist_title,
    date_start: r.date_start,
    date_end: r.date_end,
    date_display: r.date_display,
    medium_display: r.medium_display,
    artwork_type_title: r.artwork_type_title,
    image_url: r.image_url ?? r.image_id,
    image_url_small: r.image_url_small ?? r.image_id,
    image_width: r.image_width,
    image_height: r.image_height,
    alt_text: r.alt_text,
    is_public_domain: Boolean(r.is_public_domain),
    source_url: r.source_url ?? "",
    subject_titles: r.subject_titles ?? [],
    term_titles: r.term_titles ?? [],
    raw_department: r.raw_department,
  };
}

async function recomputeSubject(
  supabase: SupabaseClient,
  slug: string,
) {
  const { data: term, error: termErr } = await supabase
    .from("terms")
    .select("id, slug, canonical, display_label, aliases, status")
    .eq("slug", slug)
    .maybeSingle();
  if (termErr) throw termErr;
  if (!term) return;

  const { data: links, error: linkErr } = await supabase
    .from("artwork_terms")
    .select("artwork_id")
    .eq("term_id", term.id)
    .in("evidence_source", [...CATALOG_EVIDENCE]);
  if (linkErr) throw linkErr;
  const artworkIds = [
    ...new Set((links ?? []).map((l) => l.artwork_id as string)),
  ];

  const artworks: NormalizedArtwork[] = [];
  const dated: { id: string; date_start: number; artist_title: string | null }[] =
    [];
  for (let i = 0; i < artworkIds.length; i += 80) {
    const { data, error } = await supabase
      .from("artworks")
      .select(
        "id, source_id, title, artist_title, date_start, date_end, date_display, medium_display, artwork_type_title, image_url, image_url_small, image_id, is_public_domain, source_url, subject_titles, term_titles, raw_department, alt_text, image_width, image_height",
      )
      .in("id", artworkIds.slice(i, i + 80));
    if (error) throw error;
    for (const r of (data ?? []) as ArtRow[]) {
      const norm = rowToNorm(r);
      artworks.push(norm);
      if (norm.date_start != null && (norm.image_url || norm.image_url_small)) {
        dated.push({
          id: r.id,
          date_start: norm.date_start,
          artist_title: norm.artist_title,
        });
      }
    }
  }

  const v = validateTerm({
    canonical: term.canonical as string,
    display_label: term.display_label as string,
    artworks,
  });

  const { error: upErr } = await supabase
    .from("terms")
    .update({
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
    })
    .eq("id", term.id);
  if (upErr) throw upErr;

  await supabase.from("term_periods").delete().eq("term_id", term.id);
  const periods = computeTermPeriods(term.id as string, dated);
  if (periods.length) {
    const { error } = await supabase.from("term_periods").upsert(periods, {
      onConflict: "term_id,period_index",
    });
    if (error) throw error;
  }

  await recomputeConnectionsForTerm(supabase, term.id as string, artworkIds);
}

async function recomputeConnectionsForTerm(
  supabase: SupabaseClient,
  termId: string,
  artworkIds: string[],
) {
  if (!artworkIds.length) {
    await supabase.from("term_connections").delete().eq("source_term_id", termId);
    return;
  }

  const linkRows: ArtworkTermLink[] = [];
  for (let i = 0; i < artworkIds.length; i += 80) {
    const { data, error } = await supabase
      .from("artwork_terms")
      .select("artwork_id, term_id, evidence_source")
      .in("artwork_id", artworkIds.slice(i, i + 80))
      .in("evidence_source", [...CATALOG_EVIDENCE]);
    if (error) throw error;
    for (const row of data ?? []) {
      linkRows.push({
        artwork_id: row.artwork_id as string,
        term_id: row.term_id as string,
        evidence_source: row.evidence_source as string,
      });
    }
  }

  const termIds = [...new Set(linkRows.map((l) => l.term_id))];
  const { data: terms, error: tErr } = await supabase
    .from("terms")
    .select("id, canonical, slug, aliases, status")
    .in("id", termIds);
  if (tErr) throw tErr;
  const termMeta: TermMeta[] = (terms ?? []).map((t) => ({
    id: t.id as string,
    canonical: t.canonical as string,
    slug: t.slug as string,
    aliases: (t.aliases as string[]) ?? [],
    status: t.status as TermMeta["status"],
  }));

  const artworkTermSets = new Map<string, Set<string>>();
  for (const l of linkRows) {
    let set = artworkTermSets.get(l.artwork_id);
    if (!set) {
      set = new Set();
      artworkTermSets.set(l.artwork_id, set);
    }
    set.add(l.term_id);
  }

  const edges = computeConnections({
    terms: termMeta,
    artworkTermSets,
    minShared: 2,
  }).filter((e) => e.source_term_id === termId);

  await supabase.from("term_connections").delete().eq("source_term_id", termId);
  for (let i = 0; i < edges.length; i += 100) {
    const { error } = await supabase
      .from("term_connections")
      .upsert(edges.slice(i, i + 100));
    if (error) throw error;
  }
}

export type EnrichResult = {
  fetched: number;
  skipped: boolean;
  reason: string;
};

/**
 * Cache a few missing Met objects for this subject, then rebuild its periods.
 * No-ops when the service role is missing or enough works are already cached.
 */
export async function ensureSubjectEnriched(
  slug: string,
  opts?: { fetchCap?: number; targetCached?: number },
): Promise<EnrichResult> {
  const fetchCap = opts?.fetchCap ?? ENRICH_FETCH_CAP;
  const targetCached = opts?.targetCached ?? ENRICH_TARGET_CACHED;
  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return { fetched: 0, skipped: true, reason: "no_service_role" };
  }

  const catalogIds = await catalogIdsForSlug(supabase, slug);
  if (!catalogIds.length) {
    return { fetched: 0, skipped: true, reason: "no_catalog_ids" };
  }

  const cached = await cachedSourceIds(supabase, catalogIds);
  if (cached.size >= targetCached) {
    return { fetched: 0, skipped: true, reason: "already_cached" };
  }

  const missing = pickUncachedIds(catalogIds, cached, fetchCap);
  if (!missing.length) {
    await recomputeSubject(supabase, slug);
    return { fetched: 0, skipped: true, reason: "catalog_exhausted" };
  }

  const norms: NormalizedArtwork[] = [];
  for (const id of missing) {
    const obj = await fetchMetObject(id);
    await sleep(200);
    if (!obj) continue;
    const norm = normalizeMetObject(obj);
    if (!norm || !norm.is_public_domain || !(norm.image_url || norm.image_url_small)) {
      continue;
    }
    norms.push(norm);
  }

  if (norms.length) {
    await upsertArtworks(supabase, norms);
    await linkNewArtworks(supabase, norms);
  }
  await recomputeSubject(supabase, slug);
  return { fetched: norms.length, skipped: false, reason: "enriched" };
}
