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
  rebuildTermsAndLinks,
  startIngestionRun,
  upsertArtworks,
} from "./upsert-index";

config({ path: ".env.local" });

const MET = "https://collectionapi.metmuseum.org";
const DATA = path.resolve(process.cwd(), "data/met");
const CHECKPOINT = path.join(DATA, "csv-load-checkpoint.json");
const ELIGIBLE = path.join(DATA, "eligible-ids.json");
const CONCURRENCY = Number(process.env.MET_CSV_CONCURRENCY ?? "2");
const MAX = process.env.MET_CSV_MAX
  ? Number(process.env.MET_CSV_MAX)
  : Infinity;
const FRESH = process.env.MET_CSV_FRESH === "1";
const FETCH_GAP_MS = Number(process.env.MET_CSV_GAP_MS ?? "200");

type Checkpoint = {
  truncated: boolean;
  nextIndex: number;
  updated: number;
  skipped: number;
  fetchFailed: number;
  runId: string | null;
};

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
        const wait = 5000 * (i + 1);
        console.warn(`backoff ${res.status} ${wait}ms`);
        await sleep(wait);
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.trimStart().startsWith("<")) {
        const wait = 8000 * (i + 1);
        console.warn(`html challenge; backoff ${wait}ms`);
        await sleep(wait);
        continue;
      }
      return JSON.parse(text) as T;
    } catch (err) {
      lastErr = err;
      await sleep(1000 * (i + 1));
    }
  }
  console.warn("give up", url, lastErr);
  return null;
}

async function loadCheckpoint(): Promise<Checkpoint> {
  if (FRESH) {
    return {
      truncated: false,
      nextIndex: 0,
      updated: 0,
      skipped: 0,
      fetchFailed: 0,
      runId: null,
    };
  }
  try {
    const raw = await readFile(CHECKPOINT, "utf8");
    return JSON.parse(raw) as Checkpoint;
  } catch {
    return {
      truncated: false,
      nextIndex: 0,
      updated: 0,
      skipped: 0,
      fetchFailed: 0,
      runId: null,
    };
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
    `Eligible IDs to process: ${eligible.length} (concurrency=${CONCURRENCY})`,
  );

  let cp = await loadCheckpoint();
  if (cp.nextIndex > eligible.length) cp.nextIndex = eligible.length;

  if (!cp.truncated) {
    console.log("Truncating index via admin_truncate_index()…");
    const { error } = await supabase.rpc("admin_truncate_index");
    if (error) throw error;
    cp = {
      truncated: true,
      nextIndex: 0,
      updated: 0,
      skipped: 0,
      fetchFailed: 0,
      runId: null,
    };
    await saveCheckpoint(cp);
  }

  if (!cp.runId) {
    cp.runId = await startIngestionRun(supabase, {
      source_version: "openaccess-csv+api",
      notes: `eligible=${eligible.length}; max=${Number.isFinite(MAX) ? MAX : "all"}`,
    });
    await saveCheckpoint(cp);
  }

  const BATCH = 40;
  let sinceRebuild = 0;
  while (cp.nextIndex < eligible.length) {
    const slice = eligible.slice(cp.nextIndex, cp.nextIndex + BATCH);
    const start = cp.nextIndex;
    const norms = await mapPool(slice, CONCURRENCY, async (row) => {
      const obj = await fetchJson<MetObjectApi>(
        `${MET}/public/collection/v1/objects/${row.id}`,
      );
      await sleep(FETCH_GAP_MS);
      if (!obj) return { kind: "fail" as const };
      const norm = normalizeMetObject(obj);
      if (
        !norm ||
        !norm.is_public_domain ||
        !(norm.image_url || norm.image_url_small)
      ) {
        return { kind: "skip" as const };
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
    for (const r of norms) {
      if (r.kind === "ok") {
        toUpsert.push(r.norm);
        cp.updated++;
        sinceRebuild++;
      } else if (r.kind === "skip") cp.skipped++;
      else cp.fetchFailed++;
    }
    if (toUpsert.length) await upsertArtworks(supabase, toUpsert);

    cp.nextIndex = start + slice.length;
    await saveCheckpoint(cp);
    console.log(
      `progress ${cp.nextIndex}/${eligible.length} updated=${cp.updated} skipped=${cp.skipped} fail=${cp.fetchFailed}`,
    );

    // Keep search/journey usable during multi-hour loads
    if (sinceRebuild >= 2000) {
      console.log("Periodic terms rebuild…");
      await rebuildTermsAndLinks(supabase);
      sinceRebuild = 0;
    }
  }

  console.log("API enrich complete — rebuilding terms…");
  const rebuilt = await rebuildTermsAndLinks(supabase);

  const summary = {
    runId: cp.runId,
    eligible: eligible.length,
    updated: cp.updated,
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
