import type { ArtworkCard, SubjectSummary } from "./apiTypes";
import { createSupabaseServerClient } from "../supabase/server";

type TermRow = {
  id: string;
  slug: string;
  canonical: string;
  display_label: string;
  status: SubjectSummary["status"];
  qualifying_work_count: number;
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
    dateMin: row.date_min,
    dateMax: row.date_max,
    validationReasons: row.validation_reasons ?? [],
  };
}

export function mapArtwork(
  row: ArtworkRow,
  evidenceSource?: string | null,
): ArtworkCard {
  return {
    sourceId: row.source_id,
    title: row.title,
    artistTitle: row.artist_title,
    dateDisplay: row.date_display,
    dateStart: row.date_start,
    mediumDisplay: row.medium_display,
    artworkTypeTitle: row.artwork_type_title,
    imageId: row.image_id,
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
      "id, slug, canonical, display_label, status, qualifying_work_count, date_min, date_max, validation_reasons",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data as TermRow | null;
}

export async function searchTerms(q: string, limit = 12) {
  const supabase = createSupabaseServerClient();
  const cleaned = q.trim().replace(/%/g, "");
  if (!cleaned) {
    const { data, error } = await supabase
      .from("terms")
      .select(
        "id, slug, canonical, display_label, status, qualifying_work_count, date_min, date_max, validation_reasons",
      )
      .eq("status", "journey_ready")
      .order("qualifying_work_count", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as TermRow[];
  }

  const { data, error } = await supabase
    .from("terms")
    .select(
      "id, slug, canonical, display_label, status, qualifying_work_count, date_min, date_max, validation_reasons",
    )
    .in("status", ["journey_ready", "browse_only"])
    .or(
      `canonical.ilike.%${cleaned}%,display_label.ilike.%${cleaned}%,slug.ilike.%${cleaned}%`,
    )
    .order("qualifying_work_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TermRow[];
}

export async function suggestJourneyReady(limit = 6) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("terms")
    .select(
      "id, slug, canonical, display_label, status, qualifying_work_count, date_min, date_max, validation_reasons",
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
      "id, source_id, title, artist_title, date_display, date_start, medium_display, artwork_type_title, image_id, image_width, image_height, alt_text, source_url",
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
      "id, source_id, title, artist_title, date_display, date_start, medium_display, artwork_type_title, image_id, image_width, image_height, alt_text, source_url, subject_titles, term_titles",
    )
    .eq("source", "artic")
    .eq("source_id", sourceId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
