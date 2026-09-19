import type { NormalizedArtwork, TermStatus } from "./types";
import { isDisplayableArtwork, isLanguageRejected } from "./normalize";

export type TermAggregate = {
  canonical: string;
  display_label: string;
  artworks: NormalizedArtwork[];
};

export type TermValidation = {
  canonical: string;
  display_label: string;
  status: TermStatus;
  reasons: string[];
  qualifying_work_count: number;
  date_min: number | null;
  date_max: number | null;
  year_span: number | null;
  bucket_count: number;
  artist_count: number;
  artwork_type_count: number;
  medium_count: number;
  max_artist_share: number | null;
};

const BUCKET = 50;

/** Hard thresholds from product brief (tune after dump analysis). */
export const THRESHOLDS = {
  journeyMinWorks: 8,
  browseMinWorks: 3,
  minYearSpan: 50,
  minBuckets: 3,
  minArtists: 4,
  maxArtistShare: 0.55,
} as const;

export function validateTerm(agg: TermAggregate): TermValidation {
  const reasons: string[] = [];
  const lang = isLanguageRejected(agg.canonical);
  if (lang) {
    return base(agg, "unavailable", [lang], []);
  }

  const qualifying = agg.artworks.filter(isDisplayableArtwork);
  // Exact catalog evidence already required to enter the aggregate.

  if (qualifying.length < THRESHOLDS.browseMinWorks) {
    reasons.push(`fewer_than_${THRESHOLDS.browseMinWorks}_displayable_works`);
    return base(agg, "unavailable", reasons, qualifying);
  }

  const years = qualifying
    .map((a) => a.date_start!)
    .filter((y) => Number.isFinite(y));
  const date_min = years.length ? Math.min(...years) : null;
  const date_max = years.length ? Math.max(...years) : null;
  const year_span =
    date_min != null && date_max != null ? date_max - date_min : null;
  const buckets = new Set(years.map((y) => Math.floor(y / BUCKET) * BUCKET));
  const artists = new Set(
    qualifying.map((a) => (a.artist_title || "").toLowerCase()).filter(Boolean),
  );
  const types = new Set(
    qualifying.map((a) => a.artwork_type_title).filter(Boolean),
  );
  const media = new Set(
    qualifying.map((a) => a.medium_display).filter(Boolean),
  );

  let maxShare: number | null = null;
  if (artists.size && qualifying.length) {
    const counts = new Map<string, number>();
    for (const a of qualifying) {
      const k = (a.artist_title || "").toLowerCase();
      if (!k) continue;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    maxShare = Math.max(...counts.values()) / qualifying.length;
  }

  const stats = {
    qualifying_work_count: qualifying.length,
    date_min,
    date_max,
    year_span,
    bucket_count: buckets.size,
    artist_count: artists.size,
    artwork_type_count: types.size,
    medium_count: media.size,
    max_artist_share: maxShare,
  };

  if (qualifying.length < THRESHOLDS.journeyMinWorks) {
    reasons.push(`browse_only_depth_${qualifying.length}`);
    return { ...base(agg, "browse_only", reasons, qualifying), ...stats };
  }
  if (year_span == null || year_span < THRESHOLDS.minYearSpan) {
    reasons.push("insufficient_temporal_breadth");
    return { ...base(agg, "browse_only", reasons, qualifying), ...stats };
  }
  if (buckets.size < THRESHOLDS.minBuckets) {
    reasons.push("fewer_than_3_time_buckets");
    return { ...base(agg, "browse_only", reasons, qualifying), ...stats };
  }
  if (artists.size < THRESHOLDS.minArtists) {
    reasons.push("insufficient_creator_diversity");
    return { ...base(agg, "browse_only", reasons, qualifying), ...stats };
  }
  if (maxShare != null && maxShare > THRESHOLDS.maxArtistShare) {
    reasons.push("single_maker_over_40_percent");
    // Ranking concern for journey subset; still allow journey_ready if depth ok
    // but brief says creator diversity is hard — treat as browse_only.
    return { ...base(agg, "browse_only", reasons, qualifying), ...stats };
  }

  reasons.push("passed_hard_requirements");
  if (types.size + media.size < 2) {
    reasons.push("low_presentational_diversity_ranking_only");
  }
  return { ...base(agg, "journey_ready", reasons, qualifying), ...stats };
}

function base(
  agg: TermAggregate,
  status: TermStatus,
  reasons: string[],
  qualifying: NormalizedArtwork[],
): TermValidation {
  const years = qualifying
    .map((a) => a.date_start)
    .filter((y): y is number => y != null);
  return {
    canonical: agg.canonical,
    display_label: agg.display_label,
    status,
    reasons,
    qualifying_work_count: qualifying.length,
    date_min: years.length ? Math.min(...years) : null,
    date_max: years.length ? Math.max(...years) : null,
    year_span:
      years.length >= 2 ? Math.max(...years) - Math.min(...years) : null,
    bucket_count: new Set(years.map((y) => Math.floor(y / BUCKET) * BUCKET))
      .size,
    artist_count: new Set(
      qualifying.map((a) => (a.artist_title || "").toLowerCase()).filter(Boolean),
    ).size,
    artwork_type_count: new Set(
      qualifying.map((a) => a.artwork_type_title).filter(Boolean),
    ).size,
    medium_count: new Set(
      qualifying.map((a) => a.medium_display).filter(Boolean),
    ).size,
    max_artist_share: null,
  };
}
