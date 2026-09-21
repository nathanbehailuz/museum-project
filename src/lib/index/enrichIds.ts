import type { NormalizedArtwork } from "./types";

export const CATALOG_EVIDENCE = ["tag", "subject", "term"] as const;

export const ENRICH_FETCH_CAP = 8;
export const ENRICH_TARGET_CACHED = 8;

export function pickUncachedIds(
  catalogIds: string[],
  cached: Set<string>,
  cap: number,
): string[] {
  const out: string[] = [];
  for (const id of catalogIds) {
    if (cached.has(id)) continue;
    out.push(id);
    if (out.length >= cap) break;
  }
  return out;
}

export function artworkWriteRow(a: NormalizedArtwork) {
  return {
    source: "met" as const,
    source_id: a.source_id,
    title: a.title,
    artist_title: a.artist_title,
    date_start: a.date_start,
    date_end: a.date_end,
    date_display: a.date_display,
    medium_display: a.medium_display,
    artwork_type_title: a.artwork_type_title,
    image_url: a.image_url,
    image_url_small: a.image_url_small,
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
  };
}
