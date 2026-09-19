# Implementation Plan: Subject Museum

Status: Phase 2 complete — ready for Phase 3 (UI on indexed data)
Related documents: [Project brief](PROJECT_BRIEF.md), [PRD](prd.md), [Content audit](content-audit.md)

This document is the build order and phase gate list. The PRD stays the product contract: what must be true. Do not copy task lists back into the PRD.

A phase is done only when its test cases pass. Do not start the next phase's product work until then. Record results and gaps in the root `BUILD_LOG.md` after every meaningful change, not only at phase end.

Launch source: **Art Institute of Chicago** (official data dump + live API for bounded refresh). Images via IIIF. Index in Supabase. Do not use The Met Collection API for v1.

## Locked Decisions

| Decision | Choice |
| --- | --- |
| Museum | [Art Institute of Chicago API](https://api.artic.edu/docs/) |
| Bulk data | Official dump via [api-data](https://github.com/art-institute-of-chicago/api-data) → `https://artic-api-data.s3.amazonaws.com/artic-api-data.tar.bz2` (not paginated API scraping) |
| Live API base | `https://api.artic.edu/api/v1` — detail refresh / fallback only; throttle ~1 req/s if used for more than single-record refresh |
| Images | IIIF from `https://www.artic.edu/iiif/2/{image_id}/…`; no image binaries in Supabase Storage |
| Eligibility | `is_public_domain === true`, usable `image_id` + dimensions, dated record, exact term evidence in `subject_titles` / `term_titles` |
| Index | Supabase: `artworks`, `terms`, `artwork_terms`, `term_connections`, `ingestion_runs`, `term_periods` |
| Launch subjects | ≥3 journey-ready terms **discovered from the dump** after validation (not a hardcoded Met-style ID menu) |
| App page routes | `/subject/{slug}/journey`, `/subject/{slug}/works`, `/subject/{slug}/connections` |
| API routes (sketch) | `GET /api/subjects?q=`, `GET /api/subjects/{slug}/journey\|works\|connections`, `GET /api/artworks/{id}`, `GET /api/artworks?terms=` |
| Deploy | Vercel (or equivalent) with Supabase env vars |
| Credentials | `NEXT_PUBLIC_SUPABASE_URL`, publishable key, server-only service role — never commit secrets |
| Connections score | `shared / sqrt(n_A * n_B)`; min 3 shared qualifying works; exclude/downweight generics |
| Motion | CSS transform/opacity FLIP or View Transitions; honor `prefers-reduced-motion` |
| Normalized artwork fields | source, source_id, title, artist, dates, medium, artwork type, image_id, dimensions, alt, is_public_domain, source_url, subject/term titles, searchable document |

## Proposed Route Contracts

Names can change; document the implemented contracts in the README.

| Route | Purpose |
| --- | --- |
| `GET /api/subjects?q=` | Debounced autocomplete from validated `terms`. |
| `GET /api/subjects/{slug}/journey` | Chapters + featured works from `term_periods` / artworks. |
| `GET /api/subjects/{slug}/works` | Filtered, paginated All Works from `artwork_terms` ⋈ `artworks`. |
| `GET /api/subjects/{slug}/connections` | Precomputed edges from `term_connections`. |
| `GET /api/artworks?terms=` | Intersection / detail lists for shared works. |
| `GET /api/artworks/{id}` | Single artwork; optional live AIC refresh with cache. |

UI components call these routes, not the museum API or the Supabase service role. Image requests go to AIC IIIF.

## Phase 1. Supabase + Ingest

**Exit:** Migrations exist; dump (or documented sample slice) is cleaned, normalized, and upserted; validation statuses and rejection reasons are stored; sample load is reproducible and idempotent; ≥3 journey-ready candidates identified for review.

**Status:** Complete (2026-09-19). Supabase project `soavlmfrtmobmgesccrp`; getting-started + live enrich; 1222 artworks; journey-ready candidates in [content-audit.md](content-audit.md). Manual relevance sample still pending.

### Build, in order

1. Create Supabase project; add `.env.example` placeholders; enable RLS with public read only for intended views/RPCs.
2. Migrations for `artworks`, `terms`, `artwork_terms`, `term_connections`, `ingestion_runs`, `term_periods` (+ FTS/trigram as needed).
3. Ingest script: download dump (or use getting-started / sample slice for first pass), parse artwork JSON, normalize fields, upsert by `(source, source_id)`.
4. Extract candidate terms from `subject_titles` / `term_titles`; write `artwork_terms` with evidence source and weight.
5. Run validation pipeline; store status and reasons on `terms`.
6. Record `ingestion_runs`; re-run once to prove idempotency.
7. Update [content-audit.md](content-audit.md) with dump version, thresholds used, and candidate journey-ready subjects.

### Test cases to pass

| ID | Check | How |
| --- | --- | --- |
| P1-1 | Tables and RLS exist; service role stays server-side. | Schema review + env check |
| P1-2 | Upsert by `(source, source_id)` does not duplicate on re-run. | Automated / script |
| P1-3 | Only public-domain, image-backed, dated works with exact subject/term evidence count toward journey-ready. | Automated fixtures + sample dump |
| P1-4 | Rejected terms store reasons; journey-ready / browse-only / unavailable bands apply. | Automated + spot check |
| P1-5 | ≥3 journey-ready candidates listed in content audit for manual relevance sample. | Content audit |

## Phase 2. Compute Connections

**Exit:** `term_connections` populated for launch subjects; edges verifiable against shared artwork IDs; generics/aliases do not dominate.

**Status:** Complete (2026-09-19). 786 directed edges; `term_periods` 881 rows. Launch subjects flower / landscape / animal each have 8 outbound connections with `shared_work_count >= 3`. Run via `npm run ingest:connections`.

### Build, in order

1. Build co-occurrence pairs from qualifying `artwork_terms` on the same artwork.
2. Score with cosine-style normalization; require ≥3 shared works; drop aliases of the same concept; downweight/exclude generics (`art`, `painting`, `paper`, `people`, etc.).
3. Keep strongest edges per subject (target 4–8 for UI); store `sample_artwork_ids` and `computed_at`.
4. Optionally precompute `term_periods` chapter boundaries and featured IDs for journey-ready terms.

### Test cases to pass

| ID | Check | How |
| --- | --- | --- |
| P2-1 | Every retained edge has ≥3 shared qualifying artwork IDs that actually carry both terms. | SQL / automated |
| P2-2 | Generic and alias edges are excluded or heavily down-ranked. | Spot check launch subjects |
| P2-3 | Launch subjects expose 4–8 strong connections (or honest empty if data is sparse). | Query + content audit |

## Phase 3. UI On Indexed Data

**Exit:** Search + Journey + All Works + Connections + inspection + shareable URL for ≥3 journey-ready subjects on a deployed preview with real IIIF images.

**Status:** Not started. (Existing Met exhibition-maker UI in `src/` is previous-direction code until replaced.)

### Build, in order

1. Home search with debounced autocomplete against `/api/subjects`.
2. Subject layout: header, view switcher, shared inspection shell.
3. Journey: chronological chapters, skeletons, chapter URL state, mobile vertical timeline.
4. All Works: grid/masonry, sort/filter in URL, pagination, evidence labels.
5. Connections: network or ranked list + keyboard alternative; shared-works strip; links into Journey / intersection works.
6. Share control; back/forward; invalid subject/artwork recovery.
7. Signature motion (chapter and/or inspection FLIP); reduced-motion path.
8. Deploy preview; smoke with live indexed data.

### Test cases to pass

| ID | Check | Covers | How |
| --- | --- | --- | --- |
| P3-1 | Autocomplete returns validated subjects with useful context. | F01, F02 | Browser |
| P3-2 | Journey-ready opens Journey; browse-only / unavailable explain and suggest alternatives. | F03 | Browser |
| P3-3 | Journey shows data-derived chapters, no duplicate works, factual summaries only. | F05 | Browser |
| P3-4 | All Works filters/sort survive URL share and inspection close. | F06, F09 | Browser |
| P3-5 | Connections edges match indexed data; list/keyboard path works without the graph. | F07, N02 | Browser, keyboard |
| P3-6 | Inspection restores page, filters, period/connection, scroll, and focus. | F08 | Browser |
| P3-7 | Shared URL reconstructs state in a fresh session. | F09, F10 | Two sessions |
| P3-8 | Loading / empty / index-error / image-failure states behave per PRD §7. | states | Browser |
| P3-9 | Signature motion uses transform/opacity; reduced motion simplifies it. | N03 | Browser |
| P3-10 | Preview deploy shows real AIC metadata and IIIF images for ≥3 subjects. | Assessment | Deployed smoke |

## Phase 4. Index As Cache + Refresh

**Exit:** Re-ingest documented and runnable; live detail refresh (if shipped) uses cache + backoff; UI distinguishes missing index data from upstream outage; docs match the stack.

**Status:** Not started.

### Build, in order

1. Document and script re-ingest / refresh of the dump into Supabase (manual for assessment; note scheduled job for production).
2. Optional: single-artwork live AIC refresh with timeout, retry/backoff, success-only cache.
3. Map UI errors: empty index vs Supabase down vs museum refresh failure.
4. Finish README, `.env.example`, align this plan and PRD with what shipped.
5. Production Lighthouse mobile note; keyboard / reduced-motion pass if not done in Phase 3.
6. Optional walkthrough video.

### Test cases to pass

| ID | Check | How |
| --- | --- | --- |
| P4-1 | Re-running ingest updates rather than duplicates; `ingestion_runs` records the run. | Script |
| P4-2 | Live refresh (if present) retries transient failures and does not cache failures as success. | Automated mocks |
| P4-3 | UI copy distinguishes “not in index” from “service unavailable.” | Browser |
| P4-4 | README covers dump reproduction, AIC quirks, precomputed vs runtime, Supabase env setup. | Doc review |
| P4-5 | No secrets committed; production smoke of main journey on final URL. | Repo + live |
| P4-6 | BUILD_LOG records decisions, verification, gaps, and time. | Doc review |

## Mapping To PRD Verification

Automate: term normalization/aliases, validation rules, upsert idempotency, connection scoring, URL parse/serialize, route bounds. Mock Supabase and AIC failures. Run dump ingest and IIIF checks separately.

Capture actual results in the root `BUILD_LOG.md` rather than turning this checklist into a pass diary.
