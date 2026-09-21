/**
 * Resumable subject-wide Met enrichment.
 *
 * Usage:
 *   npm run ingest:subject -- coat-of-arm
 *
 * Resume checkpoint:
 *   data/met/subject-{slug}-checkpoint.json
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import {
  normalizeMetObject,
  type MetObjectApi,
} from "../../src/lib/index/normalize";
import { recomputeSubject } from "../../src/lib/index/enrich";
import type { NormalizedArtwork } from "../../src/lib/index/types";
import {
  fetchAllRows,
  startIngestionRun,
  upsertArtworks,
} from "./upsert-index";

config({ path: ".env.local" });

const MET = "https://collectionapi.metmuseum.org";
const DATA = path.resolve(process.cwd(), "data/met");
const CONCURRENCY = Math.max(
  1,
  Number(process.env.MET_SUBJECT_CONCURRENCY ?? "2"),
);
const FETCH_GAP_MS = Math.max(
  0,
  Number(process.env.MET_SUBJECT_GAP_MS ?? "350"),
);
const BATCH_SIZE = Math.max(
  1,
  Number(process.env.MET_SUBJECT_BATCH_SIZE ?? "30"),
);

type Checkpoint = {
  slug: string;
  total: number;
  nextIndex: number;
  updated: number;
  already: number;
  skipped: number;
  linked: number;
  failedIds: string[];
  runId: string | null;
};

type FetchResult =
  | { kind: "ok"; sourceId: string; norm: NormalizedArtwork }
  | { kind: "already"; sourceId: string }
  | { kind: "skip"; sourceId: string }
  | { kind: "fail"; sourceId: string };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await fn(items[index]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
  return results;
}

async function fetchMetObject(
  sourceId: string,
  attempts = 8,
): Promise<MetObjectApi | "skip" | null> {
  let lastError: unknown;
  const url = `${MET}/public/collection/v1/objects/${sourceId}`;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "museum-exhibition-met-ingest/1.0 (educational; polite)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(45_000),
      });
      if (response.status === 404) return "skip";
      if (response.status === 403 || response.status === 429) {
        const wait = Math.min(120_000, 8_000 * 2 ** attempt);
        console.warn(`backoff ${response.status} ${wait}ms id=${sourceId}`);
        await sleep(wait);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const text = await response.text();
      if (text.trimStart().startsWith("<")) {
        const wait = Math.min(120_000, 8_000 * 2 ** attempt);
        console.warn(`html challenge; backoff ${wait}ms id=${sourceId}`);
        await sleep(wait);
        continue;
      }
      return JSON.parse(text) as MetObjectApi;
    } catch (error) {
      lastError = error;
      await sleep(Math.min(30_000, 1_000 * 2 ** attempt));
    }
  }
  console.warn(`give up id=${sourceId}`, lastError);
  return null;
}

async function linkToSubject(
  supabase: SupabaseClient,
  termId: string,
  sourceIds: string[],
): Promise<number> {
  if (!sourceIds.length) return 0;
  const { data, error } = await supabase
    .from("artworks")
    .select("id")
    .eq("source", "met")
    .in("source_id", sourceIds);
  if (error) throw error;
  const links = (data ?? []).map((row) => ({
    artwork_id: row.id as string,
    term_id: termId,
    evidence_source: "tag",
    relevance_weight: 1,
  }));
  if (!links.length) return 0;
  const { error: linkError } = await supabase
    .from("artwork_terms")
    .upsert(links, { onConflict: "artwork_id,term_id,evidence_source" });
  if (linkError) throw linkError;
  return links.length;
}

function emptyCheckpoint(slug: string, total: number): Checkpoint {
  return {
    slug,
    total,
    nextIndex: 0,
    updated: 0,
    already: 0,
    skipped: 0,
    linked: 0,
    failedIds: [],
    runId: null,
  };
}

async function main() {
  const slug = process.argv[2]?.trim();
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error(
      "Pass a normalized subject slug, e.g. npm run ingest:subject -- coat-of-arm",
    );
  }

  await mkdir(DATA, { recursive: true });
  const checkpointPath = path.join(DATA, `subject-${slug}-checkpoint.json`);
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: term, error: termError } = await supabase
    .from("terms")
    .select("id, display_label")
    .eq("slug", slug)
    .single();
  if (termError) throw termError;

  const tagRows = await fetchAllRows<{ source_id: string }>(() =>
    supabase
      .from("object_tags")
      .select("source_id")
      .eq("slug", slug)
      .order("source_id", { ascending: true }),
  );
  const catalogIds = [...new Set(tagRows.map((row) => row.source_id))];
  if (!catalogIds.length) throw new Error(`No object_tags rows for ${slug}`);

  let checkpoint = emptyCheckpoint(slug, catalogIds.length);
  if (process.env.MET_SUBJECT_FRESH !== "1") {
    try {
      const saved = JSON.parse(
        await readFile(checkpointPath, "utf8"),
      ) as Partial<Checkpoint>;
      if (saved.slug === slug && saved.total === catalogIds.length) {
        checkpoint = { ...checkpoint, ...saved };
      }
    } catch {
      // First run.
    }
  }

  const saveCheckpoint = async () => {
    await writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));
  };

  if (!checkpoint.runId) {
    checkpoint.runId = await startIngestionRun(supabase, {
      source_version: `api-subject-bulk:${slug}`,
      notes: JSON.stringify({
        slug,
        total: catalogIds.length,
        processed: checkpoint.nextIndex,
        status: "running",
      }),
    });
    await saveCheckpoint();
  }

  const existingRows = await fetchAllRows<{ source_id: string }>(() =>
    supabase.from("artworks").select("source_id").eq("source", "met"),
  );
  const existing = new Set(existingRows.map((row) => row.source_id));
  const startedAt = Date.now();
  const startedIndex = checkpoint.nextIndex;

  const processBatch = async (sourceIds: string[]): Promise<string[]> => {
    const results = await mapPool(sourceIds, CONCURRENCY, async (sourceId) => {
      if (existing.has(sourceId)) {
        return { kind: "already", sourceId } satisfies FetchResult;
      }
      const object = await fetchMetObject(sourceId);
      await sleep(FETCH_GAP_MS);
      if (object === null) {
        return { kind: "fail", sourceId } satisfies FetchResult;
      }
      if (object === "skip") {
        return { kind: "skip", sourceId } satisfies FetchResult;
      }
      const norm = normalizeMetObject(object);
      if (
        !norm ||
        !norm.is_public_domain ||
        !(norm.image_url || norm.image_url_small)
      ) {
        return { kind: "skip", sourceId } satisfies FetchResult;
      }
      return { kind: "ok", sourceId, norm } satisfies FetchResult;
    });

    const fetched = results
      .filter((result): result is Extract<FetchResult, { kind: "ok" }> =>
        result.kind === "ok",
      )
      .map((result) => result.norm);
    if (fetched.length) {
      await upsertArtworks(supabase, fetched);
      for (const artwork of fetched) existing.add(artwork.source_id);
    }

    const linkable = results
      .filter((result) => result.kind === "ok" || result.kind === "already")
      .map((result) => result.sourceId);
    checkpoint.linked += await linkToSubject(
      supabase,
      term.id as string,
      linkable,
    );
    checkpoint.updated += fetched.length;
    checkpoint.already += results.filter(
      (result) => result.kind === "already",
    ).length;
    checkpoint.skipped += results.filter(
      (result) => result.kind === "skip",
    ).length;
    return results
      .filter((result) => result.kind === "fail")
      .map((result) => result.sourceId);
  };

  while (checkpoint.nextIndex < catalogIds.length) {
    const start = checkpoint.nextIndex;
    const batch = catalogIds.slice(start, start + BATCH_SIZE);
    const failed = await processBatch(batch);
    checkpoint.failedIds.push(...failed);
    checkpoint.failedIds = [...new Set(checkpoint.failedIds)];
    checkpoint.nextIndex = start + batch.length;
    await saveCheckpoint();

    const processedThisRun = checkpoint.nextIndex - startedIndex;
    const elapsedSeconds = Math.max(1, (Date.now() - startedAt) / 1000);
    const rate = processedThisRun / elapsedSeconds;
    const remaining = catalogIds.length - checkpoint.nextIndex;
    const etaHours = rate > 0 ? remaining / rate / 3600 : 0;
    const notes = JSON.stringify({
      slug,
      total: catalogIds.length,
      processed: checkpoint.nextIndex,
      cached: checkpoint.updated + checkpoint.already,
      updated: checkpoint.updated,
      skipped: checkpoint.skipped,
      failed: checkpoint.failedIds.length,
      status: "running",
    });
    const { error } = await supabase
      .from("ingestion_runs")
      .update({ artworks_upserted: checkpoint.updated, notes })
      .eq("id", checkpoint.runId);
    if (error) throw error;
    console.log(
      `progress ${checkpoint.nextIndex}/${catalogIds.length} updated=${checkpoint.updated} skipped=${checkpoint.skipped} failed=${checkpoint.failedIds.length} eta~${etaHours.toFixed(1)}h`,
    );
  }

  if (checkpoint.failedIds.length) {
    console.log(`Retrying ${checkpoint.failedIds.length} transient failures…`);
    checkpoint.failedIds = await processBatch(checkpoint.failedIds);
    await saveCheckpoint();
  }

  await recomputeSubject(supabase, slug);
  const finished = checkpoint.failedIds.length === 0;
  const notes = JSON.stringify({
    slug,
    total: catalogIds.length,
    processed: checkpoint.nextIndex,
    updated: checkpoint.updated,
    already: checkpoint.already,
    skipped: checkpoint.skipped,
    linked: checkpoint.linked,
    failed: checkpoint.failedIds.length,
    status: finished ? "complete" : "retry_required",
  });
  const { error: finishError } = await supabase
    .from("ingestion_runs")
    .update({
      ...(finished ? { finished_at: new Date().toISOString() } : {}),
      artworks_upserted: checkpoint.updated,
      artwork_terms_upserted: checkpoint.linked,
      notes,
      error_summary: finished
        ? null
        : `${checkpoint.failedIds.length} IDs need retry`,
    })
    .eq("id", checkpoint.runId);
  if (finishError) throw finishError;

  console.log(notes);
  if (!finished) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
