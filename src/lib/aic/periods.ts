export type PeriodArtwork = {
  id: string;
  date_start: number;
  artist_title: string | null;
};

export type TermPeriodRow = {
  term_id: string;
  period_index: number;
  label: string;
  begin_year: number;
  end_year: number;
  work_count: number;
  featured_artwork_ids: string[];
};

const BUCKET = 50;
const FEATURED_CAP = 4;

export function computeTermPeriods(
  termId: string,
  artworks: PeriodArtwork[],
): TermPeriodRow[] {
  const dated = artworks
    .filter((a) => Number.isFinite(a.date_start))
    .sort((a, b) => a.date_start - b.date_start);
  if (!dated.length) return [];

  const buckets = new Map<number, PeriodArtwork[]>();
  for (const a of dated) {
    const start = Math.floor(a.date_start / BUCKET) * BUCKET;
    const list = buckets.get(start) ?? [];
    list.push(a);
    buckets.set(start, list);
  }

  const keys = [...buckets.keys()].sort((a, b) => a - b);
  return keys.map((begin, period_index) => {
    const end = begin + BUCKET - 1;
    const works = buckets.get(begin)!;
    return {
      term_id: termId,
      period_index,
      label: `${begin}–${end}`,
      begin_year: begin,
      end_year: end,
      work_count: works.length,
      featured_artwork_ids: pickFeatured(works, FEATURED_CAP),
    };
  });
}

/** Prefer distinct artists when selecting featured works. */
function pickFeatured(works: PeriodArtwork[], cap: number): string[] {
  const picked: string[] = [];
  const artists = new Set<string>();
  for (const w of works) {
    if (picked.length >= cap) break;
    const artist = (w.artist_title || "").toLowerCase();
    if (artist && artists.has(artist)) continue;
    if (artist) artists.add(artist);
    picked.push(w.id);
  }
  if (picked.length < cap) {
    for (const w of works) {
      if (picked.length >= cap) break;
      if (!picked.includes(w.id)) picked.push(w.id);
    }
  }
  return picked;
}
