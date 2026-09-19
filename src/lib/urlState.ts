import { getDefaultSubjectSlug, getPublishedSubject, getSubjectOrNull } from "./subjects";

export const MAX_TITLE_LENGTH = 80;

export type ExhibitionUrlState = {
  subject: string;
  ids: [number, number, number];
  title: string;
};

export type UrlParseErrorCode =
  | "invalid_subject"
  | "invalid_ids"
  | "duplicate_ids"
  | "ids_not_in_pool"
  | "title_too_long";

export type UrlParseResult =
  | { ok: true; state: ExhibitionUrlState; usedDefaultTitle: boolean }
  | { ok: false; error: UrlParseErrorCode; message: string };

function parseIdsParam(raw: string | null): number[] | null {
  if (raw == null || raw.trim() === "") return null;
  const parts = raw.split(",").map((p) => p.trim());
  if (parts.length !== 3) return null;
  const ids: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const n = Number(part);
    if (!Number.isInteger(n) || n <= 0) return null;
    ids.push(n);
  }
  return ids;
}

export function serializeExhibitionState(state: ExhibitionUrlState): string {
  const params = new URLSearchParams();
  params.set("subject", state.subject);
  params.set("ids", state.ids.join(","));
  params.set("title", state.title);
  return `?${params.toString()}`;
}

export function buildShareUrl(
  origin: string,
  pathname: string,
  state: ExhibitionUrlState,
): string {
  const path = pathname || "/";
  return `${origin}${path}${serializeExhibitionState(state)}`;
}

/**
 * Parse exhibition state from URL search params.
 * Empty search → default subject exhibition with default title/ids.
 */
export function parseExhibitionSearchParams(
  searchParams: URLSearchParams,
): UrlParseResult {
  const hasAny =
    searchParams.has("subject") ||
    searchParams.has("ids") ||
    searchParams.has("title");

  if (!hasAny) {
    const slug = getDefaultSubjectSlug();
    const subject = getPublishedSubject(slug);
    if (!subject || subject.defaultArtworkIds.length < 3) {
      return {
        ok: false,
        error: "invalid_subject",
        message: "Default subject is not configured.",
      };
    }
    const ids = subject.defaultArtworkIds.slice(0, 3) as [number, number, number];
    return {
      ok: true,
      state: { subject: subject.slug, ids, title: subject.defaultTitle },
      usedDefaultTitle: true,
    };
  }

  const subjectParam = searchParams.get("subject");
  const subject = getSubjectOrNull(subjectParam);
  if (!subject) {
    return {
      ok: false,
      error: "invalid_subject",
      message: "Unsupported or missing subject in the shared link.",
    };
  }

  const ids = parseIdsParam(searchParams.get("ids"));
  if (!ids) {
    return {
      ok: false,
      error: "invalid_ids",
      message: "The shared link must include exactly three valid artwork IDs.",
    };
  }

  if (new Set(ids).size !== 3) {
    return {
      ok: false,
      error: "duplicate_ids",
      message: "The shared link lists duplicate artwork IDs.",
    };
  }

  const pool = new Set(subject.artworkIds);
  if (!ids.every((id) => pool.has(id))) {
    return {
      ok: false,
      error: "ids_not_in_pool",
      message: "One or more artwork IDs are not in the reviewed pool for this subject.",
    };
  }

  const rawTitle = searchParams.get("title");
  let title: string;
  let usedDefaultTitle = false;
  if (rawTitle == null || rawTitle.trim() === "") {
    title = subject.defaultTitle;
    usedDefaultTitle = true;
  } else {
    title = rawTitle;
    if (title.length > MAX_TITLE_LENGTH) {
      return {
        ok: false,
        error: "title_too_long",
        message: `Exhibition titles can be at most ${MAX_TITLE_LENGTH} characters.`,
      };
    }
  }

  return {
    ok: true,
    state: {
      subject: subject.slug,
      ids: ids as [number, number, number],
      title,
    },
    usedDefaultTitle,
  };
}

export function commitTitle(
  input: string,
  subjectDefaultTitle: string,
): string {
  const trimmed = input.trim();
  if (!trimmed) return subjectDefaultTitle;
  return trimmed.slice(0, MAX_TITLE_LENGTH);
}
