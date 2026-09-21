import type {
  ArtworkCard,
  CatalogGraphEdge,
  CatalogGraphNode,
  SubjectSummary,
} from "./apiTypes";
import { createSupabaseServerClient } from "../supabase/server";
import { isGenericCanonical } from "../index/normalize";

type TermRow = {
  id: string;
  slug: string;
  canonical: string;
  display_label: string;
  status: SubjectSummary["status"];
  qualifying_work_count: number;
  catalog_work_count: number;
  date_min: number | null;
  date_max: number | null;
  validation_reasons: string[] | null;
};

type ArtworkRow = {
  id: string;
  source_id: string;
  title: string | null;
  artist_title: string | null;
  date_display: string | null;
  date_start: number | null;
  medium_display: string | null;
  artwork_type_title: string | null;
  image_id: string | null;
  image_url?: string | null;
  image_url_small?: string | null;
  image_width: number | null;
  image_height: number | null;
  alt_text: string | null;
  source_url: string;
};

export function mapTerm(row: TermRow): SubjectSummary {
  return {
    slug: row.slug,
    canonical: row.canonical,
    displayLabel: row.display_label,
    status: row.status,
    qualifyingWorkCount: row.qualifying_work_count,
    catalogWorkCount: row.catalog_work_count ?? 0,
    dateMin: row.date_min,
    dateMax: row.date_max,
    validationReasons: row.validation_reasons ?? [],
  };
}

export function mapArtwork(
  row: ArtworkRow,
  evidenceSource?: string | null,
): ArtworkCard {
  const imageUrl =
    row.image_url_small ||
    row.image_url ||
    row.image_id ||
    null;
  return {
    sourceId: row.source_id,
    title: row.title,
    artistTitle: row.artist_title,
    dateDisplay: row.date_display,
    dateStart: row.date_start,
    mediumDisplay: row.medium_display,
    artworkTypeTitle: row.artwork_type_title,
    imageUrl,
    imageWidth: row.image_width,
    imageHeight: row.image_height,
    altText: row.alt_text,
    sourceUrl: row.source_url,
    evidenceSource: evidenceSource ?? null,
  };
}

export async function getTermBySlug(slug: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("terms")
    .select(
      "id, slug, canonical, display_label, status, qualifying_work_count, catalog_work_count, date_min, date_max, validation_reasons",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as TermRow | null;
}

export async function searchTerms(q: string, limit = 12) {
  const supabase = createSupabaseServerClient();
  const cleaned = q.trim().replace(/%/g, "");
  const columns =
    "id, slug, canonical, display_label, status, qualifying_work_count, catalog_work_count, date_min, date_max, validation_reasons";
  if (!cleaned) {
    const { data, error } = await supabase
      .from("terms")
      .select(columns)
      .eq("status", "journey_ready")
      .order("qualifying_work_count", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as TermRow[];
  }

  const { data, error } = await supabase
    .from("terms")
    .select(columns)
    .or(
      `canonical.ilike.%${cleaned}%,display_label.ilike.%${cleaned}%,slug.ilike.%${cleaned}%`,
    )
    .or("catalog_work_count.gt.0,qualifying_work_count.gt.0")
    .order("catalog_work_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TermRow[];
}

export async function suggestJourneyReady(limit = 6) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("terms")
    .select(
      "id, slug, canonical, display_label, status, qualifying_work_count, catalog_work_count, date_min, date_max, validation_reasons",
    )
    .eq("status", "journey_ready")
    .order("qualifying_work_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TermRow[];
}

export async function getArtworksByIds(ids: string[]) {
  if (!ids.length) return [] as ArtworkRow[];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("artworks")
    .select(
      "id, source_id, title, artist_title, date_display, date_start, medium_display, artwork_type_title, image_id, image_url, image_url_small, image_width, image_height, alt_text, source_url",
    )
    .in("id", ids);
  if (error) throw error;
  return (data ?? []) as ArtworkRow[];
}

export async function getArtworkBySourceId(sourceId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("artworks")
    .select(
      "id, source_id, title, artist_title, date_display, date_start, medium_display, artwork_type_title, image_id, image_url, image_url_small, image_width, image_height, alt_text, source_url, subject_titles, term_titles",
    )
    .eq("source", "met")
    .eq("source_id", sourceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Dump-deep subjects for the homepage catalog graph (no Met API).
 * Nodes: catalog_work_count >= 8, non-generic.
 * Edges: journey_ready ↔ journey_ready only.
 */
export async function getCatalogGraph(): Promise<{
  nodes: CatalogGraphNode[];
  edges: CatalogGraphEdge[];
}> {
  const supabase = createSupabaseServerClient();
  const PAGE = 1000;
  const termRows: {
    id: string;
    slug: string;
    canonical: string;
    display_label: string;
    status: SubjectSummary["status"];
    catalog_work_count: number;
  }[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("terms")
      .select("id, slug, canonical, display_label, status, catalog_work_count")
      .gte("catalog_work_count", 8)
      .order("catalog_work_count", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = data ?? [];
    termRows.push(...batch);
    if (batch.length < PAGE) break;
  }

  const filtered = termRows.filter((t) => !isGenericCanonical(t.canonical));
  const byId = new Map(filtered.map((t) => [t.id, t]));
  const readyIds = filtered
    .filter((t) => t.status === "journey_ready")
    .map((t) => t.id);

  const thumbByTermId = new Map<string, string>();
  if (readyIds.length) {
    const { data: periods, error: pErr } = await supabase
      .from("term_periods")
      .select("term_id, featured_artwork_ids")
      .in("term_id", readyIds)
      .order("period_index", { ascending: true });
    if (pErr) throw pErr;

    const firstArtIdByTerm = new Map<string, string>();
    for (const p of periods ?? []) {
      const tid = p.term_id as string;
      if (firstArtIdByTerm.has(tid)) continue;
      const ids = (p.featured_artwork_ids as string[]) ?? [];
      if (ids[0]) firstArtIdByTerm.set(tid, ids[0]);
    }
    const artIds = [...new Set(firstArtIdByTerm.values())];
    const arts = await getArtworksByIds(artIds);
    const artById = new Map(arts.map((a) => [a.id, a]));
    for (const [tid, aid] of firstArtIdByTerm) {
      const a = artById.get(aid);
      const url = a?.image_url_small || a?.image_url || a?.image_id || null;
      if (url) thumbByTermId.set(tid, url);
    }
  }

  const nodes: CatalogGraphNode[] = filtered.map((t) => ({
    slug: t.slug,
    label: t.display_label,
    status: t.status,
    imageUrl: thumbByTermId.get(t.id) ?? null,
  }));

  const edges: CatalogGraphEdge[] = [];
  const seenPair = new Set<string>();
  if (readyIds.length) {
    const { data: connRows, error: cErr } = await supabase
      .from("term_connections")
      .select("source_term_id, target_term_id, shared_work_count")
      .in("source_term_id", readyIds);
    if (cErr) throw cErr;

    for (const row of connRows ?? []) {
      const src = byId.get(row.source_term_id as string);
      const tgt = byId.get(row.target_term_id as string);
      if (!src || !tgt) continue;
      if (src.status !== "journey_ready" || tgt.status !== "journey_ready") {
        continue;
      }
      const a = src.slug < tgt.slug ? src.slug : tgt.slug;
      const b = src.slug < tgt.slug ? tgt.slug : src.slug;
      const key = `${a}|${b}`;
      if (seenPair.has(key)) continue;
      seenPair.add(key);
      edges.push({
        source: src.slug,
        target: tgt.slug,
        sharedWorkCount: row.shared_work_count as number,
      });
    }
  }

  return { nodes, edges };
}
