/** Shared AIC types for ingest + future BFF. */

export type EvidenceSource = "subject" | "term" | "title" | "description";
export type TermStatus = "journey_ready" | "browse_only" | "unavailable";

export type ArticArtworkApi = {
  id: number;
  title?: string | null;
  artist_title?: string | null;
  date_start?: number | null;
  date_end?: number | null;
  date_display?: string | null;
  medium_display?: string | null;
  artwork_type_title?: string | null;
  image_id?: string | null;
  thumbnail?: { width?: number; height?: number; alt_text?: string | null } | null;
  is_public_domain?: boolean | null;
  subject_titles?: string[] | null;
  term_titles?: string[] | null;
  alt_text?: string | null;
  department_title?: string | null;
};

export type NormalizedArtwork = {
  source: "artic";
  source_id: string;
  title: string | null;
  artist_title: string | null;
  date_start: number | null;
  date_end: number | null;
  date_display: string | null;
  medium_display: string | null;
  artwork_type_title: string | null;
  image_id: string | null;
  image_width: number | null;
  image_height: number | null;
  alt_text: string | null;
  is_public_domain: boolean;
  source_url: string;
  subject_titles: string[];
  term_titles: string[];
  raw_department: string | null;
};

export type NormalizedTermLink = {
  source_id: string;
  canonical: string;
  display_label: string;
  evidence_source: EvidenceSource;
  relevance_weight: number;
};

export const ARTIC_FIELDS = [
  "id",
  "title",
  "artist_title",
  "date_start",
  "date_end",
  "date_display",
  "medium_display",
  "artwork_type_title",
  "image_id",
  "thumbnail",
  "is_public_domain",
  "subject_titles",
  "term_titles",
  "alt_text",
  "department_title",
].join(",");
