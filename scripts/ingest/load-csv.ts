/**
 * Full Met Open Access load: eligible CSV IDs → Collection API enrich → upsert.
 *
 * Usage:
 *   npm run ingest:download
 *   npm run ingest:csv-filter   # or let this script run filter if missing
 *   npm run ingest:csv
 *
 * Resume: data/met/csv-load-checkpoint.json
 * Fresh start: MET_CSV_FRESH=1 npm run ingest:csv
 *
 * Optional: MET_CSV_MAX=500 to cap IDs (smoke). Default = all eligible.
 */
import { createClient } from "@supabase/supabase-js";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import {
  normalizeMetObject,
  type MetObjectApi,
} from "../../src/lib/index/normalize";
import type { NormalizedArtwork } from "../../src/lib/index/types";
import {
  fetchAllRows,
  finishIngestionRun,
  rebuildTermsAndLinks,
  startIngestionRun,
  upsertArtworks,
} from "./upsert-index";

config({ path: ".env.local" });

const MET = "https://collectionapi.metmuseum.org";
const DATA = path.resolve(process.cwd(), "data/met");
const CHECKPOINT = path.join(DATA, "csv-load-checkpoint.json");
const ELIGIBLE = path.join(DATA, "eligible-ids.json");
const CONCURRENCY = Number(process.env.MET_CSV_CONCURRENCY ?? "1");
const MAX = process.env.MET_CSV_MAX
  ? Number(process.env.MET_CSV_MAX)
  : Infinity;
const FRESH = process.env.MET_CSV_FRESH === "1";
const FETCH_GAP_MS = Number(process.env.MET_CSV_GAP_MS ?? "500");
const REBUILD_EVERY = Number(process.env.MET_CSV_REBUILD_EVERY ?? "10000");

type Checkpoint = {
  truncated: boolean;
  nextIndex: number;
  updated: number;
  skipped: number;
  fetchFailed: number;
  already: number;
  runId: string | null;
};

type FetchResult =
  | { kind: "ok"; norm: NormalizedArtwork }
  | { kind: "skip" }
  | { kind: "already" }
  | { kind: "fail" };

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson<T>(url: string, attempts = 8): Promise<T | null> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "museum-exhibition-met-ingest/1.0 (educational; polite)",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(45_000),
      });
      if (res.status === 404) return null;
      if (res.status === 403 || res.status === 429) {
        const wait = Math.min(120_000, 8_000 * 2 ** i);
        console.warn(`backoff ${res.status} ${wait}ms`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.trimStart().startsWith("<")) {
        const wait = Math.min(120_000, 8_000 * 2 ** i);
        console.warn(`html challenge; backoff ${wait}ms`);
        await sleep(wait);
        continue;
      }
      return JSON.parse(text) as T;
    } catch (err) {
      lastErr = err;
      await sleep(Math.min(30_000, 1_000 * 2 ** i));
    }
  }
  console.warn("give up", url, lastErr);
  return null;
}

function emptyCheckpoint(): Checkpoint {
  return {
    truncated: false,
    nextIndex: 0,
    updated: 0,
    skipped: 0,
    fetchFailed: 0,
    already: 0,
    runId: null,
  };
}

async function loadCheckpoint(): Promise<Checkpoint> {
  if (FRESH) return emptyCheckpoint();
  try {
    const raw = await readFile(CHECKPOINT, "utf8");
    const parsed = JSON.parse(raw) as Partial<Checkpoint>;
    return {
      ...emptyCheckpoint(),
      ...parsed,
      already: parsed.already ?? 0,
    };
  } catch {
    return emptyCheckpoint();
  }
}

async function saveCheckpoint(cp: Checkpoint) {
  await writeFile(CHECKPOINT, JSON.stringify(cp, null, 2));
}

async function ensureEligibleIds(): Promise<{ id: number; tags: string[] }[]> {
  try {
    await access(ELIGIBLE);
  } catch {
    console.log("eligible-ids.json missing — running csv-filter…");
    const { spawn } = await import("node:child_process");
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["--import", "tsx", "scripts/ingest/csv-filter.ts"],
        { stdio: "inherit", cwd: process.cwd() },
      );
      child.on("exit", (code) =>
        code === 0 ? resolve() : reject(new Error(`csv-filter exit ${code}`)),
      );
    });
  }
  const raw = JSON.parse(await readFile(ELIGIBLE, "utf8")) as
    | number[]
    | { id: number; tags: string[] }[];
  const rows = raw.map((r) =>
    typeof r === "number" ? { id: r, tags: [] as string[] } : r,
  );
  return rows.slice(0, Number.isFinite(MAX) ? MAX : undefined);
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
  return results;
}

async function main() {
  await mkdir(DATA, { recursive: true });
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const eligible = await ensureEligibleIds();
  console.log(
    `Eligible IDs to process: ${eligible.length} (concurrency=${CONCURRENCY} gap=${FETCH_GAP_MS}ms)`,
  );

  let cp = await loadCheckpoint();
  if (cp.nextIndex > eligible.length) cp.nextIndex = eligible.length;

  if (FRESH) {
    console.log("Truncating index via admin_truncate_index()…");
    const { error } = await supabase.rpc("admin_truncate_index");
    if (error) throw error;
    cp = emptyCheckpoint();
    cp.truncated = true;
    await saveCheckpoint(cp);
  } else if (!cp.truncated) {
    console.log(
      "Resume without truncate (set MET_CSV_FRESH=1 to wipe). Marking truncated=true.",
    );
    cp.truncated = true;
    await saveCheckpoint(cp);
  }

  if (!cp.runId) {
    cp.runId = await startIngestionRun(supabase, {
      source_version: "openaccess-csv+api",
      notes: `eligible=${eligible.length}; max=${Number.isFinite(MAX) ? MAX : "all"}`,
    });
    await saveCheckpoint(cp);
  }

  const existingRows = await fetchAllRows<{ source_id: string }>(() =>
    supabase.from("artworks").select("source_id").eq("source", "met"),
  );
  const existing = new Set(existingRows.map((r) => r.source_id));
  console.log(`Already in index: ${existing.size}; resume at ${cp.nextIndex}`);

  const BATCH = 40;
  const FAIL_THRESHOLD = Math.max(5, Math.ceil(BATCH * 0.25));
  let sinceRebuild = 0;
  const sessionStart = Date.now();
  const sessionIndex = cp.nextIndex;

  while (cp.nextIndex < eligible.length) {
    const slice = eligible.slice(cp.nextIndex, cp.nextIndex + BATCH);
    const start = cp.nextIndex;
    const norms = await mapPool(slice, CONCURRENCY, async (row) => {
      if (existing.has(String(row.id))) return { kind: "already" } as const;
      const obj = await fetchJson<MetObjectApi>(
        `${MET}/public/collection/v1/objects/${row.id}`,
      );
      await sleep(FETCH_GAP_MS);
      if (!obj) return { kind: "fail" } as const;
      const norm = normalizeMetObject(obj);
      if (
        !norm ||
        !norm.is_public_domain ||
        !(norm.image_url || norm.image_url_small)
      ) {
        return { kind: "skip" } as const;
      }
      if (!norm.subject_titles.length && row.tags.length) {
        norm.subject_titles = row.tags;
      } else if (row.tags.length) {
        const lower = new Set(norm.subject_titles.map((t) => t.toLowerCase()));
        for (const t of row.tags) {
          if (!lower.has(t.toLowerCase())) norm.subject_titles.push(t);
        }
      }
      return { kind: "ok" as const, norm };
    });

    const toUpsert: NormalizedArtwork[] = [];
    let batchUpdated = 0;
    let batchSkipped = 0;
    let batchFailed = 0;
    let batchAlready = 0;
    for (const r of norms) {
      if (r.kind === "ok") {
        toUpsert.push(r.norm);
        batchUpdated++;
      } else if (r.kind === "skip") batchSkipped++;
      else if (r.kind === "already") batchAlready++;
      else batchFailed++;
    }
    if (toUpsert.length) {
      await upsertArtworks(supabase, toUpsert);
      for (const a of toUpsert) existing.add(a.source_id);
    }

    cp.updated += batchUpdated;
    cp.skipped += batchSkipped;
    cp.already += batchAlready;
    sinceRebuild += batchUpdated;

    if (batchFailed >= FAIL_THRESHOLD) {
      await saveCheckpoint(cp);
      throw new Error(
        `Too many fetch failures (${batchFailed}/${slice.length}) at index ${start}; restart will retry this batch`,
      );
    }

    cp.fetchFailed += batchFailed;
    cp.nextIndex = start + slice.length;
    await saveCheckpoint(cp);

    const doneSession = cp.nextIndex - sessionIndex;
    const elapsedSec = Math.max(1, (Date.now() - sessionStart) / 1000);
    const rate = doneSession / elapsedSec;
    const remaining = eligible.length - cp.nextIndex;
    const etaH = rate > 0 ? remaining / rate / 3600 : 0;
    console.log(
      `progress ${cp.nextIndex}/${eligible.length} updated=${cp.updated} already=${cp.already} skipped=${cp.skipped} fail=${cp.fetchFailed} eta~${etaH.toFixed(1)}h`,
    );

    if (REBUILD_EVERY > 0 && sinceRebuild >= REBUILD_EVERY) {
      console.log("Periodic terms rebuild…");
      await rebuildTermsAndLinks(supabase);
      sinceRebuild = 0;
    }
  }

  console.log("API enrich complete — rebuilding terms…");
  const rebuilt = await rebuildTermsAndLinks(supabase);

  if (cp.runId) {
    await finishIngestionRun(supabase, cp.runId, {
      artworks_upserted: cp.updated,
      terms_upserted: rebuilt.terms,
      artwork_terms_upserted: rebuilt.links,
      journey_ready_count: rebuilt.journey_ready.length,
      notes: `eligible=${eligible.length}; updated=${cp.updated}; already=${cp.already}; skipped=${cp.skipped}; fail=${cp.fetchFailed}`,
    });
  }

  const summary = {
    runId: cp.runId,
    eligible: eligible.length,
    updated: cp.updated,
    already: cp.already,
    skipped: cp.skipped,
    fetchFailed: cp.fetchFailed,
    terms: rebuilt.terms,
    links: rebuilt.links,
    journey_ready_count: rebuilt.journey_ready.length,
    journey_ready_sample: rebuilt.journey_ready.slice(0, 30),
  };
  await writeFile(
    path.join(DATA, "csv-load-summary.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log("Done.", summary);
  console.log("Next: npm run ingest:connections");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
