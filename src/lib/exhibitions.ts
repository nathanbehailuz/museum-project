import { EXHIBITION_DEADLINE_MS, fetchEligibleArtworks, type FetchObjectOptions } from "./met/client";
import { getSubjectOrNull } from "./subjects";
import type { ExhibitionResponse } from "./types";

export type LoadExhibitionOptions = {
  fetchImpl?: typeof fetch;
  deadlineMs?: number;
  /** Override default IDs (tests / empty-pool fixtures). */
  artworkIds?: number[];
};

export async function loadExhibition(
  subjectParam: string | null,
  options: LoadExhibitionOptions = {},
): Promise<ExhibitionResponse> {
  const subject = getSubjectOrNull(subjectParam);

  if (!subject) {
    return {
      ok: false,
      error: "invalid_subject",
      message: "Unsupported or missing subject.",
    };
  }

  const ids = options.artworkIds ?? subject.defaultArtworkIds;

  if (ids.length < 3) {
    return {
      ok: false,
      error: "insufficient_content",
      message: "This subject does not have enough artworks yet.",
    };
  }

  const deadlineMs = options.deadlineMs ?? EXHIBITION_DEADLINE_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);

  const fetchOptions: FetchObjectOptions = {
    fetchImpl: options.fetchImpl,
    signal: controller.signal,
  };

  try {
    const { artworks, upstreamFailed } = await fetchEligibleArtworks(ids, fetchOptions);

    if (artworks.length < 3) {
      if (upstreamFailed) {
        return {
          ok: false,
          error: "upstream_error",
          message: "The museum API did not respond in time. Please try again.",
        };
      }
      return {
        ok: false,
        error: "insufficient_content",
        message: "Not enough eligible artworks are available for this subject.",
      };
    }

    return {
      ok: true,
      subject: subject.slug,
      title: subject.defaultTitle,
      artworks: artworks.slice(0, 3),
    };
  } catch {
    return {
      ok: false,
      error: "upstream_error",
      message: "The museum API did not respond in time. Please try again.",
    };
  } finally {
    clearTimeout(timer);
  }
}
