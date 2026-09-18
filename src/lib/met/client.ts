import { normalizeMetObject, type MetObject } from "./normalize";
import type { Artwork } from "../types";

export const MET_BASE = "https://collectionapi.metmuseum.org";
export const MET_USER_AGENT = "museum-exhibition-maker (phase2; local-dev)";

/** Per-object timeout; Met cold starts often exceed 8s (Phase 1 finding). */
export const MET_OBJECT_TIMEOUT_MS = 20_000;

/** Total budget for the exhibition route (three parallel object fetches). */
export const EXHIBITION_DEADLINE_MS = 25_000;

export class MetFetchError extends Error {
  constructor(
    message: string,
    readonly causeKind: "timeout" | "network" | "http" | "parse",
  ) {
    super(message);
    this.name = "MetFetchError";
  }
}

export type FetchObjectOptions = {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

export async function fetchMetObject(
  id: number,
  options: FetchObjectOptions = {},
): Promise<MetObject> {
  const timeoutMs = options.timeoutMs ?? MET_OBJECT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${MET_BASE}/public/collection/v1/objects/${id}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onOuterAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", onOuterAbort, { once: true });
  }

  try {
    const res = await fetchImpl(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": MET_USER_AGENT,
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      throw new MetFetchError(`Met object ${id} returned ${res.status}`, "http");
    }

    try {
      return (await res.json()) as MetObject;
    } catch {
      throw new MetFetchError(`Met object ${id} returned invalid JSON`, "parse");
    }
  } catch (err) {
    if (err instanceof MetFetchError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new MetFetchError(`Met object ${id} timed out after ${timeoutMs}ms`, "timeout");
    }
    throw new MetFetchError(
      `Met object ${id} network error: ${err instanceof Error ? err.message : String(err)}`,
      "network",
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onOuterAbort);
  }
}

export async function fetchEligibleArtworks(
  ids: number[],
  options: FetchObjectOptions = {},
): Promise<{ artworks: Artwork[]; upstreamFailed: boolean }> {
  const results = await Promise.allSettled(
    ids.map((id) => fetchMetObject(id, options)),
  );

  const artworks: Artwork[] = [];
  let upstreamFailed = false;

  for (const result of results) {
    if (result.status === "rejected") {
      upstreamFailed = true;
      continue;
    }
    const artwork = normalizeMetObject(result.value);
    if (artwork) artworks.push(artwork);
  }

  return { artworks, upstreamFailed };
}
