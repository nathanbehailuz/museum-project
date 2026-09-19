export type TermStatus = "journey_ready" | "browse_only" | "unavailable";

export type SubjectSummary = {
  slug: string;
  canonical: string;
  displayLabel: string;
  status: TermStatus;
  qualifyingWorkCount: number;
  dateMin: number | null;
  dateMax: number | null;
  validationReasons: string[];
};

export type ArtworkCard = {
  sourceId: string;
  title: string | null;
  artistTitle: string | null;
  dateDisplay: string | null;
  dateStart: number | null;
  mediumDisplay: string | null;
  artworkTypeTitle: string | null;
  /** Direct JPEG URL (Met primaryImageSmall / primaryImage). */
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  altText: string | null;
  sourceUrl: string;
  evidenceSource?: string | null;
};

export type JourneyChapter = {
  periodIndex: number;
  label: string;
  beginYear: number | null;
  endYear: number | null;
  workCount: number;
  featured: ArtworkCard[];
};

export type ConnectionEdgeCard = {
  targetSlug: string;
  targetLabel: string;
  sharedWorkCount: number;
  connectionScore: number;
  samples: ArtworkCard[];
};

export type ApiErrorBody = {
  error: "not_found" | "unavailable" | "invalid_query" | "index_error";
  message: string;
  suggestions?: SubjectSummary[];
};
