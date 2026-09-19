import { normalizeMetObject, type MetObject } from "./normalize";
import type { Artwork } from "../types";

export const MET_BASE = "https://collectionapi.metmuseum.org";
export const MET_USER_AGENT = "museum-exhibition-maker (phase3; vercel)";

/** Per-object timeout; Met cold starts often exceed 8s (Phase 1 finding). */
export const MET_OBJECT_TIMEOUT_MS = 20_000;

/** Total budget for multi-object routes (three parallel fetches). */
export const EXHIBITION_DEADLINE_MS = 25_000;

/** Successful metadata cache TTL (B04). Failures are never cached as success. */
export const MET_CACHE_REVALIDATE_SECONDS = 3600;

/** At most two retries after the first attempt (B05). */
export const MET_MAX_RETRIES = 2;

export class MetFetchError extends Error {
  constructor(
    message: string,
    readonly causeKind: "timeout" | "network" | "http" | "parse",
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "MetFetchError";
  }
}

export type FetchObjectOptions = {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  /** When false, skip Next.js fetch cache (tests / forced refresh). Default true. */
  useCache?: boolean;
  /** Disable retries (tests). Default false. */
  disableRetry?: boolean;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
      return;
    }
    const timer = setTimeout(resolve, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function parseRetryAfterMs(res: Response): number | undefined {
  const raw = res.headers.get("Retry-After");
  if (!raw) return undefined;
  const asInt = Number(raw);
  if (Number.isFinite(asInt) && asInt >= 0) return asInt * 1000;
  const date = Date.parse(raw);
  if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
  return undefined;
}

function isRetryable(err: MetFetchError): boolean {
  if (err.causeKind === "timeout" || err.causeKind === "network") return true;
  if (err.causeKind === "http" && err.status != null) {
    return err.status === 429 || err.status >= 500;
  }
  return false;
}

async function fetchMetObjectOnce(
  id: number,
  options: FetchObjectOptions,
): Promise<MetObject> {
  const timeoutMs = options.timeoutMs ?? MET_OBJECT_TIMEOUT_MS;
  const fetchImpl = options.fetchImpl ?? fetch;
  const url = `${MET_BASE}/public/collection/v1/objects/${id}`;
  const useCache = options.useCache !== false && fetchImpl === fetch;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const onOuterAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", onOuterAbort, { once: true });
  }

  try {
    const init: RequestInit & { next?: { revalidate: number } } = {
      headers: {
        Accept: "application/json",
        "User-Agent": MET_USER_AGENT,
      },
      signal: controller.signal,
    };

    if (useCache) {
      init.next = { revalidate: MET_CACHE_REVALIDATE_SECONDS };
    } else {
      init.cache = "no-store";
    }

    const res = await fetchImpl(url, init);

    if (!res.ok) {
      throw new MetFetchError(
        `Met object ${id} returned ${res.status}`,
        "http",
        res.status,
        parseRetryAfterMs(res),
      );
    }

    try {
      return (await res.json()) as MetObject;
    } catch {
      throw new MetFetchError(`Met object ${id} returned invalid JSON`, "parse");
    }
  } catch (err) {
    if (err instanceof MetFetchError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new MetFetchError(
        `Met object ${id} timed out after ${timeoutMs}ms`,
        "timeout",
      );
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

/**
 * Fetch a Met object with bounded retries for transient failures (B05).
 * Successful responses may be cached via Next fetch revalidate (B04).
 */
export async function fetchMetObject(
  id: number,
  options: FetchObjectOptions = {},
): Promise<MetObject> {
  const maxRetries = options.disableRetry ? 0 : MET_MAX_RETRIES;
  let attempt = 0;
  let lastError: MetFetchError | undefined;

  while (attempt <= maxRetries) {
    if (options.signal?.aborted) {
      throw new MetFetchError(`Met object ${id} aborted`, "timeout");
    }
    try {
      return await fetchMetObjectOnce(id, options);
    } catch (err) {
      const metErr =
        err instanceof MetFetchError
          ? err
          : new MetFetchError(String(err), "network");
      lastError = metErr;
      if (!isRetryable(metErr) || attempt >= maxRetries) throw metErr;

      const backoff = metErr.retryAfterMs ?? 250 * 2 ** attempt;
      await sleep(backoff, options.signal);
      attempt += 1;
    }
  }

  throw lastError ?? new MetFetchError(`Met object ${id} failed`, "network");
}

export type SlotResult =
  | { id: number; status: "ok"; artwork: Artwork }
  | { id: number; status: "unavailable"; reason: "ineligible" | "upstream" };

export async function fetchArtworkSlots(
  ids: number[],
  options: FetchObjectOptions = {},
): Promise<{ slots: SlotResult[]; upstreamFailed: boolean }> {
  const results = await Promise.allSettled(
    ids.map((id) => fetchMetObject(id, options)),
  );

  const slots: SlotResult[] = [];
  let upstreamFailed = false;

  results.forEach((result, index) => {
    const id = ids[index]!;
    if (result.status === "rejected") {
      upstreamFailed = true;
      slots.push({ id, status: "unavailable", reason: "upstream" });
      return;
    }
    const artwork = normalizeMetObject(result.value);
    if (!artwork) {
      slots.push({ id, status: "unavailable", reason: "ineligible" });
      return;
    }
    slots.push({ id, status: "ok", artwork });
  });

  return { slots, upstreamFailed };
}

export async function fetchEligibleArtworks(
  ids: number[],
  options: FetchObjectOptions = {},
): Promise<{ artworks: Artwork[]; upstreamFailed: boolean }> {
  const { slots, upstreamFailed } = await fetchArtworkSlots(ids, options);
  return {
    artworks: slots
      .filter((s): s is Extract<SlotResult, { status: "ok" }> => s.status === "ok")
      .map((s) => s.artwork),
    upstreamFailed,
  };
}
