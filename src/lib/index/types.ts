/** Shared index types (Met-backed Subject Museum). */

export type EvidenceSource = "tag" | "subject" | "term" | "title" | "description";
export type TermStatus = "journey_ready" | "browse_only" | "unavailable";

export type NormalizedArtwork = {
  source: "met";
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
