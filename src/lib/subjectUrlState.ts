export type SubjectView = "journey" | "works" | "connections";

export type WorksSort = "date" | "relevance" | "artist" | "title";

export type SubjectUrlState = {
  chapter: number | null;
  artwork: string | null;
  related: string | null;
  sort: WorksSort;
  type: string | null;
  medium: string | null;
  artist: string | null;
  from: number | null;
  to: number | null;
  page: number;
};

const DEFAULTS: SubjectUrlState = {
  chapter: null,
  artwork: null,
  related: null,
  sort: "date",
  type: null,
  medium: null,
  artist: null,
  from: null,
  to: null,
  page: 1,
};

function intOrNull(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function positivePage(raw: string | null): number {
  const n = intOrNull(raw);
  return n != null && n >= 1 ? n : 1;
}

export function parseSubjectSearchParams(
  searchParams: URLSearchParams,
): SubjectUrlState {
  const sortRaw = searchParams.get("sort");
  const sort: WorksSort =
    sortRaw === "relevance" ||
    sortRaw === "artist" ||
    sortRaw === "title" ||
    sortRaw === "date"
      ? sortRaw
      : "date";

  return {
    chapter: intOrNull(searchParams.get("chapter")),
    artwork: emptyToNull(searchParams.get("artwork")),
    related: emptyToNull(searchParams.get("related")),
    sort,
    type: emptyToNull(searchParams.get("type")),
    medium: emptyToNull(searchParams.get("medium")),
    artist: emptyToNull(searchParams.get("artist")),
    from: intOrNull(searchParams.get("from")),
    to: intOrNull(searchParams.get("to")),
    page: positivePage(searchParams.get("page")),
  };
}

function emptyToNull(v: string | null): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length ? t : null;
}

export function serializeSubjectSearchParams(
  state: Partial<SubjectUrlState>,
): string {
  const merged = { ...DEFAULTS, ...state };
  const params = new URLSearchParams();
  if (merged.chapter != null) params.set("chapter", String(merged.chapter));
  if (merged.artwork) params.set("artwork", merged.artwork);
  if (merged.related) params.set("related", merged.related);
  if (merged.sort !== "date") params.set("sort", merged.sort);
  if (merged.type) params.set("type", merged.type);
  if (merged.medium) params.set("medium", merged.medium);
  if (merged.artist) params.set("artist", merged.artist);
  if (merged.from != null) params.set("from", String(merged.from));
  if (merged.to != null) params.set("to", String(merged.to));
  if (merged.page > 1) params.set("page", String(merged.page));
  const q = params.toString();
  return q ? `?${q}` : "";
}

export function subjectPath(
  slug: string,
  view: SubjectView,
  state?: Partial<SubjectUrlState>,
): string {
  const base = `/subject/${encodeURIComponent(slug)}/${view}`;
  return `${base}${serializeSubjectSearchParams(state ?? {})}`;
}
