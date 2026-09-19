# Parked: Full Met Open Access CSV → Supabase load

**Status:** Parked — move on with the partial / API-slice index.  
**Date:** 2026-09-19  
**Product impact:** None for launch. Flower / landscape / animal stay `journey_ready` on the current index.

## One-line summary

Enriching **139,568** eligible Met Open Access objects into Supabase cannot finish at a practical speed: Collection API / Incapsula **403**s force concurrency 1, multi-day wall time, and background loaders keep dying. Resume via checkpoint later if a full catalog is needed.

## Symptoms

| Observation | Detail |
| --- | --- |
| Filter complete | `MetObjects.csv` 484,956 rows → **139,568** eligible (PD + tags + usable date) |
| Load incomplete | Checkpoint ~**480** processed / ~**478** upserted of 139,568 |
| Process dies | `csv-load.pid` / nohup / LaunchAgent runs do not stay up for multi-hour jobs |
| Rate limit | Concurrency 8 → mass fetch failures; concurrency 1 + gap still hits `backoff 403` |
| ETA | Remaining ~139k at ~1.5–10s/object ≈ **~58–386 hours** |

## Root cause

1. **CSV has no image URLs.** JPEG fields come only from live `GET /public/collection/v1/objects/{id}`.
2. **Incapsula / WAF.** Aggressive parallelism returns 403 / challenge HTML; loader backs off (`scripts/ingest/load-csv.ts`).
3. **Job durability.** Long runs under agent shells / fragile LaunchAgent config exit before completion — not a schema/upsert bug. Successful fetches upsert cleanly.

## What we already built

- Pipeline: `ingest:download` → `ingest:csv-filter` → `ingest:csv` (checkpoint resume) → `ingest:connections`
- Shared upsert: `scripts/ingest/upsert-index.ts`
- Eligible IDs ordered with launch-tag priority (~35k first)
- `admin_truncate_index` RPC; gitignored CSV + checkpoints
- Soft refresh path for existing rows (`ingest:refresh`) — separate from this bulk enrich

## Current checkpoint (at park time)

```json
{
  "truncated": true,
  "nextIndex": 480,
  "updated": 478,
  "skipped": 0,
  "fetchFailed": 2
}
```

See also: `data/met/csv-filter-summary.json`, `data/met/csv-load.log`, `data/met/csv-load-checkpoint.json`.

## Resume later (when ready)

1. Do **not** set `MET_CSV_FRESH=1` unless intentionally wiping the index.
2. Keep polite fetch: `MET_CSV_CONCURRENCY=1`, `MET_CSV_GAP_MS≥500`.
3. Run in a durable shell (Terminal.app / `tmux`), machine awake, with `SUPABASE_SERVICE_ROLE_KEY` loaded.
4. `npm run ingest:csv` then `npm run ingest:connections` (and `ingest:rebuild-terms` if needed).
5. Optional demo cap: `MET_CSV_MAX=5000` or finish the ~35k priority launch-tag IDs only.
6. Do **not** raise concurrency until 403s stay rare for a long stretch.

## Out of scope for this park note

- Manual image relevance review for launch subjects (still pending separately).
- Soft-refresh fetch failures on the small existing Met slice (re-run `ingest:refresh`).
- Unused Met exhibition-maker gallery code under `src/app`.
