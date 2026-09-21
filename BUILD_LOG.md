# Build Log: Subject Museum

Assignment: Creative, API-Integrated Web App
Related documents: [Project brief](docs/PROJECT_BRIEF.md), [PRD](docs/prd.md), [Implementation plan](docs/IMPLEMENTATION_PLAN.md), [Content audit](docs/content-audit.md)

Working log at the repo root. Update after every meaningful change, not only at phase end. Do not claim unchecked work passed.

## Goal & scope decision

**Current product (docs pivoted 2026-09-19; Met-first runtime):** a searchable digital museum. Visitor types a validated subject, follows a chronological Journey, browses Connections (catalog co-occurrence), inspects artworks, and shares URL state. Pitch: *Type a thing. See how artists have pictured it across time.*

Primary source: **The Met** Open Access CSV tag index + Collection API enrich → Supabase; app reads the index via Next.js BFF; Met JPEG URLs (no image binaries in Storage). Advanced features: ingest + validation + BFF; signature motion; shareable URL + server-backed autocomplete.

Must ship: reproducible sample ingest, validation pipeline, ≥3 journey-ready subjects from data, Journey / All Works / Connections, shared inspection, shareable URLs, one signature transition, loading/empty/error states.

**Previous direction (Met exhibition maker):** three-work Met exhibition maker — gallery/API files remain unused; home is now the subject museum.

## Goal & scope decision (historical — Met exhibition maker)

Building a small exhibition maker: a visitor opens a complete three-work show of everyday subjects in art, inspects works, replaces and reorders them, names the show, and shares a URL that reconstructs it.

Using The Met Collection API for live metadata and open-access JPEG images, with a manually reviewed ID pool for visual relevance. No API key. Primary advanced feature is a Next.js backend-for-frontend with validation, cache, retry/backoff, and graceful upstream failure. Shareable URL state is a required product capability, not the assessment's optional search feature.

Left out to keep the product small: accounts, database, private collections, multiple museums, catalog search, essays, annotation, zoom, drag-and-drop, editorial prompts, and downloadable exhibition images. Launch with one verified subject (`windows`); add chairs/bowls only after the core journey works. Hands needs a wider ID hunt.

## Stack & tooling

- Next.js 15 App Router + TypeScript; route handlers as the BFF for subject museum.
- **Supabase** project `soavlmfrtmobmgesccrp` (org museum-project) — artworks/terms/artwork_terms + connections/periods.
- Art Institute of Chicago getting-started + live API enrich; IIIF image URLs.
- Vitest (including `src/lib/aic` normalize/validate/url state).
- Ingest scripts: `npm run ingest:download`, `ingest`, `ingest:load-cache`, `ingest:connections`.
- Deploy: Vercel — https://museum-exhibition-iota.vercel.app (Phase 3 subject UI)

## Key decisions & trade-offs

- Decision (2026-09-19 Phase 1): use existing empty Supabase project in org `museum-project` rather than creating a second paid project ($0/mo).
- Decision: Phase 1 sample = AIC **getting-started** ID universe + **live API enrich** (not full S3 dump yet). Getting-started alone lacks subjects/PD/images.
- Decision (2026-09-21): **journey_ready** = non-generic + `catalog_work_count ≥ 8`. Edges from Met dump `object_tags` co-occurrence (not only cached artworks). Homepage scatter + CSS monograms.
- Decision (2026-09-21): Connections only link `journey_ready` ↔ `journey_ready` (browse_only spokes dropped). Generic blocklist keeps medium/century/nationality; depicted people allowed.
- Decision (2026-09-21): Journey renders every deduplicated **cached** displayable work for the subject (chronological), not only period featured IDs. Full dump catalog remains a later bulk-cache job.
- Decision (2026-09-21): Submission polish replaces raw “Loading…” copy with shimmer skeletons reused from existing `--skeleton` tokens; search and journey paging expose empty/error/retry.
 - Decision: blocklist generics/techniques (`painting`, `oil on canvas`, fairs, centuries) so journey-ready favors concrete nouns (flower, landscape, animal, …).
- Decision (2026-09-19): pivot product from Met three-work exhibition maker to AIC dump–indexed subject museum (Journey / All Works / Connections) with Supabase. Alternative considered: finish Met Phase 4–5 then expand; rejected because the assessment story and data model are a different product. Docs updated first; code still Met until ingest phase.
- Decision: switch from Art Institute of Chicago to The Met Collection API because it requires no key and exposes direct JPEG URLs. Alternative considered: keep AIC; rejected after product direction chose Met. **Superseded by 2026-09-19 pivot back to AIC dump + Supabase.**
- Decision: reviewed artwork ID pools plus live metadata, because keyword/tag search often matches catalog text without showing the subject, and Met `hasImages=true` does not guarantee open-access images. Alternative considered: live search-only; rejected for visual relevance. **Historical for Met maker; new product uses dump validation + status bands instead.**
- Decision: BFF route handlers as the advanced feature, because the assessment needs a real client/server boundary, validation, cache, and upstream resilience. Alternative considered: client-only museum calls; rejected. **Still true; BFF now centers on ingest + index + serve.**
- Decision: shareable URL as source of truth, no required local storage or accounts. Alternative considered: save exhibitions server-side; out of scope.
- Decision: default subject `windows` with nine Met object IDs; default exhibition `[9817, 14808, 453573]`. Config in `data/subjects.json`. **Historical Met launch config.**
- Decision: Phase 2/3 exhibition deadline ~25s total / ~20s per object (parallel). Successful Met metadata cached 1 hour via Next `fetch` `revalidate`; failures never cached as success; at most two retries on network/429/5xx.
- Decision: use `/public/collection/v1.1/search` now; `/v1/search` retires 1 Oct 2026.

## Hard parts / dead ends

- Getting-started JSONL has only 5 fields — cannot validate journeys without live enrich or full dump.
- Naive singularization turned `canvas` → `canva`; fixed with a do-not-singularize set.
- Temporary anon write RLS used for bootstrap load (no service_role in env); **revoked after ingest**. Put real `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` for future runs.
- Met object endpoint is often slow (~15–25s cold). Parallel batches with short timeouts failed in Phase 1; Phase 2 uses ~20s per request and parallel default-ID fetches.
- First “windows” tag search returned many Tiffany design drawings that were not public domain and had no `primaryImage`. Had to switch to stained-glass / architectural window queries.
- Object 1457 is titled “Casement Window” but its primary image did not clearly show a window; excluded after visual review.
- `create-next-app` hung / refused the non-empty repo; scaffolded package.json and App Router files manually.
- Early Vercel deploy attempts hung with no output; a later `vercel deploy --yes --prod` succeeded after CLI auth as `nz2212-1161`.

## How I verified it works

Phase test cases live in the implementation plan. Record pass/fail and gaps here.

| Phase | Status | Result |
| --- | --- | --- |
| 1. Confirm scope and content | Complete | P1-1–P1-4 passed. Met live audit; `windows` locked with 9 IDs; decisions recorded; docs retargeted off AIC. |
| 2. Vertical slice and first deploy | Complete | Next.js gallery + `/api/exhibitions`; Vitest; production https://museum-exhibition-iota.vercel.app shows three live Windows works. |
| 3. Curation, inspection, and sharing | Complete | Artworks/replacements APIs; chairs subject; URL share state; inspect modal; replace/reorder/title; cache+retry; Vitest 17; redeployed. |
| 4. Polish and verify | Not started | |
| 5. Release and document | Not started | |

### Phase 1 test results

| ID | Result | Notes |
| --- | --- | --- |
| P1-1 | Pass | Nine distinct eligible windows IDs in `data/subjects.json` |
| P1-2 | Pass | Each launch ID live-fetched with `isPublicDomain` and `primaryImage` |
| P1-3 | Pass | Manual review of small JPEGs; title/tag-only and misleading images rejected |
| P1-4 | Pass | Locked decisions in implementation plan, content audit, PRD §12, and this log |

### Phase 2 test results

| ID | Result | Notes |
| --- | --- | --- |
| P2-1 | Pass | Default visit loads three works + title `Windows` (local + production) |
| P2-2 | Pass | Uncropped images; title/artist/date; empty artist → “Artist unknown” |
| P2-3 | Pass | Artwork-shaped skeletons + visually hidden loading status |
| P2-4 | Pass | Vitest: bad subject → `invalid_subject`, fetch not called |
| P2-5 | Pass | Vitest eligibility + live Met sample IDs 9817/14808/453573 |
| P2-6 | Pass | Vitest normalize shape / empty-string → null |
| P2-7 | Pass | Vitest mocked upstream failure → `upstream_error`; UI Retry control |
| P2-8 | Pass | Vitest insufficient pool / ineligible fixture |
| P2-9 | Pass | Gallery grid: 1-col mobile, 3-col ≥768; checked in browser |
| P2-10 | Pass | Production API returns live Met metadata; gallery renders real images |

Live URL: https://museum-exhibition-iota.vercel.app

### AIC Phase 3 (subject museum UI) test results

| ID | Result | Notes |
| --- | --- | --- |
| P3-1 | Pass | Autocomplete `q=flow` → flower (local + prod) |
| P3-2 | Pass | flower/landscape/animal journey_ready; unavailable layout suggests alternatives |
| P3-3 | Pass | Journey chapters with featured IIIF ids (14 / 11 / 23 periods) |
| P3-4 | Pass | Works filters/sort in URL via `subjectUrlState` |
| P3-5 | Pass | Connections ranked list + radial; keyboard list primary |
| P3-6 | Pass | Inspection `?artwork=`; Escape + focus return |
| P3-7 | Pass | Share copies/share URL; path+query preserved |
| P3-8 | Pass | Empty filters, image fallback, index-error copy |
| P3-9 | Pass | Chapter fade / inspect enter; `prefers-reduced-motion` disables |
| P3-10 | Pass | Production https://museum-exhibition-iota.vercel.app smoked for 3 subjects |

### Phase 3 test results (historical Met exhibition maker)

| ID | Result | Notes |
| --- | --- | --- |
| P3-1 | Pass | Replace via `/api/replacements` excludes current IDs; UI keeps title |
| P3-2 | Pass | `pendingReplace` lock; failed replace leaves slot unchanged |
| P3-3 | Pass | Move left/right (up/down on mobile); ends disabled |
| P3-4 | Pass | Vitest `commitTitle` + 80-char clamp; input is plain text |
| P3-5 | Pass | Inspection modal: primary image, medium, Met link, focus trap, Escape |
| P3-6 | Pass | `?subject=&ids=&title=`; production reconstructs Soft Glass share |
| P3-7 | Pass | Clipboard failure shows selectable textarea; success live region |
| P3-8 | Pass | Subject change `pushState`; title/curate `replaceState`; popstate reload |
| P3-9 | Pass | Vitest URL parse rejects bad subject/ids/dupes/long title; UI recovery |
| P3-10 | Pass | `/api/artworks` per-slot unavailable; UI Replace/Reset |
| P3-11 | Pass | Chairs published; subject select loads Chairs defaults |
| P3-12 | Pass | Next fetch `revalidate: 3600` on success; tests force `no-store` |
| P3-13 | Pass | Vitest: retry 503/429, no retry on 404, Retry-After honored |
| P3-14 | Pass | Deployed smoke on iota alias + shared URL |

## Known limitations

- Phase 1 index is getting-started slice (~1222 enriched works), not the full AIC dump.
- Manual relevance review (≥80% of ≤12 samples) for flower/landscape/animal still pending.
- Put `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` before re-running ingest (anon write policies revoked).
- Met exhibition-maker code remains under `src/app` API/gallery files but is unused by the home route.
- Preview deployments may have Vercel SSO; production alias is public.
- Met pivot live DDL applied; soft refresh populates `image_url` / `image_url_small` (18/98 Met object fetches failed on last refresh — re-run `ingest:refresh` to backfill).
- Soft refresh does not rebuild terms; use full `npm run ingest` (or clean TRUNCATE reload) to expand subjects.
- **On-demand Met cache:** CSV tags live in `object_tags` (~237k rows, 1109 subjects). Opening a subject fetches up to 8 missing objects and caches them. Overnight 139k crawl stopped (~2673 artworks already cached). Production needs `SUPABASE_SERVICE_ROLE_KEY` on the server for first-visit enrich.
- Subject UI is two pages only (chronological constellation + connections graph); All Works route redirects to journey.
- Homepage Collection map: ~891 dump-deep subjects as CSS monograms in a filled scatter; edges from object_tags co-occurrence (4842 directed rows / ~2k undirected). Journey loads Met works on first open via enrich.
- Connections ignore browse_only targets. Re-run `npm run ingest:connections` after tag reloads.
- Journey “all” means all **cached** qualifying works linked to the subject (dated + image), not the full `catalog_work_count` dump set until those IDs are enriched.
## Time spent

| Phase | Time | Notes |
| --- | --- | --- |
| 1. Confirm scope and content (Met) | ~1.5–2 h | Historical |
| 2. Vertical slice and first deploy (Met) | ~2–2.5 h | Historical |
| 3. Curation, inspection, and sharing (Met) | ~2–2.5 h | Historical |
| Docs pivot + AIC retarget | ~1 h | Brief/PRD/plan |
| Phase 1 AIC Supabase + getting-started ingest | ~2–2.5 h | Schema, enrich, validate, load |
| Phase 2 connections + periods | ~0.5–1 h | Scoring module, script, verify |
| Phase 3 UI on indexed data | ~2–2.5 h | BFF, search, journey/works/connections, deploy |
| Phase 4 Met index refresh | ~0.5 h | Soft refresh script + docs; live smoke |
| Full catalog ingest resume | ~0.5 h | Started then stopped; replaced by on-demand |
| On-demand tag index + enrich | ~1 h | object_tags, lazy Met fetch, chair journey_ready |
| Homepage catalog graph + tighter edges | ~1 h | 891-node map; journey_ready-only links; generics |
| Journey horizontal scroll | <0.5 h | All featured nodes; expanding canvas; scroll/focus polish |
| Submission polish (skeletons + docs) | <1 h | Loading UX, search/journey retry, README |
| Total | ~16–18.5 h | On-demand cache, not full dump crawl |

## Session notes

### 2026-09-21 (Submission polish: skeletons, states, README)

- Replaced raw “Loading…” Suspense/map/inspection copy with shimmer skeletons (`MuseumSkeletons` + `skeletons.module.css`) using existing `--skeleton` tokens.
- Search: empty “no match”, error + retry, list shimmer while fetching.
- Journey: “Loading more works…” chip + retry when multi-page cached feed fails; zoom buttons get `aria-label`; constellation `:focus-visible`; softer mobile field height.
- README: features, architecture, API rationale, advanced BFF feature, testing commands.
- Verified: TypeScript clean; Vitest 41/41; ESLint clean on touched museum UI files.

### 2026-09-21 (Journey: all featured works + horizontal scroll)

- Removed the Journey UI caps of 16 total / 3 per period; `pickWorks` now keeps every unique featured work in chronological order while preserving epoch filtering.
- Replaced viewport recompression with an expanding constellation canvas and a fixed 174px minimum center gap. The field now scrolls horizontally with touch/trackpad support and a discreet scrollbar.
- Focused `?artwork=` nodes scroll into view horizontally; existing zoom, SVG paths, and artwork inspection remain wired to the expanded canvas.
- Fixed the blocking homepage 500: Next 15 rejects `next/dynamic({ ssr: false })` in the server `page.tsx`, so the existing client component is imported directly; its `mounted` guard still delays React Flow until the browser.
- Verified: ESLint clean; TypeScript clean; Vitest 41/41; production build passes. Local `/` and `/subject/flower/journey` return 200. Browser smoke rendered 23 Flower nodes in a 5,764px horizontal scroll area (711px viewport).

### 2026-09-21 (`frame.join` overlay + client-only map)

- Dev redbox `Runtime TypeError: frame.join is not a function` comes from React Flight’s `buildFakeCallStack` (Next error overlay), not app code — it often masks a hydration/HMR failure.
- Initial workaround loaded `HomeCatalogGraph` via `next/dynamic({ ssr: false })`; this was later removed because Next 15 rejects that option in Server Components. The graph’s internal `mounted` guard is the supported client-only render boundary.

### 2026-09-21 (Collection map: focus constellation)

- Default: no edges (avoids hairball). Hover focuses a subject → only its spokes draw; others dim to ~12%.
- Node size scales with `log(catalog_work_count)`. Labels only for focus/neighbors (and top-depth hubs at rest).
- Meta line updates with focused subject + neighbor count.

### 2026-09-21 (Catalog journey_ready + connected map)

- **journey_ready** = `catalog_work_count ≥ 8` (891 terms flipped in SQL; enrich no longer downgrades on thin cache).
- Rebuilt **4842** `term_connections` from `object_tags` co-occurrence (min 3 shared, top-K 8). Enrich no longer overwrites dump edges.
- Homepage: filled hash scatter (no doughnut); CSS monogram icons only (no Met thumbs); meta shows subject/link counts.
- Verified: Vitest 41/41; horse/portrait/flower each have 8 edges; ingest:connections summary written.

### 2026-09-21 (Catalog graph hydration fix)

- React Flow on the homepage SSR’d transform styles that disagreed with the client (`2049.26px` vs full float). Mounted React Flow only after `useEffect`; rounded layout positions. Header/meta still SSR.

### 2026-09-21 (Homepage catalog graph + journey_ready-only edges)

- Removed floating flower ambient thumbs from the homepage.
- Added **Collection map**: React Flow graph of dump-deep subjects (`catalog_work_count ≥ 8`, ~891 nodes). Journey-ready nodes use cached thumbs; others use letter glyphs. Edges only between journey_ready pairs. Click → subject journey. No Met API on home load.
- Connections: `eligibleTarget` requires `journey_ready` (no browse_only spokes). Kept top-K 8. API/page filter stored edges by target status until recompute.
- Generics tightened: still block medium/technique/century/nationality; allow depicted people (`man`, `woman`, `figure`, …).
- `journeyMinWorks` lowered 8 → 5 (does not change current 6 journey_ready subjects; horse/tree still fail artist/bucket bars).
- Verified: Vitest 39/39; home shows 891 nodes; Flower node click → `/subject/flower/journey`; Animal connections SSR only Flower (no Washington); Flower API connections = bird + animal.

### 2026-09-21 (Connections: click node for shared works)

- Removed the related-subject chip row under the graph. Shared works appear only after clicking a node.
- Dropped the “View shared works” control; node click is the selector.
- Verified locally on Flower: no chip row; click Bird → “72 works tagged with both Flower and Bird”; click Coat Of Arm → “47 works tagged with both Flower and Coat Of Arm”.

### 2026-09-20 (Connections = React Flow graph; BCE epochs)

- Replaced the CSS/SVG hub with **React Flow** (`@xyflow/react`): real nodes + straight edges. Edge thickness scales with shared-work count.
- Current subject is the same thumbnail card as related nodes, with a gold border. Clicking a related node still selects it.
- Epoch chips use `formatYearRange` so `-50 – -1` reads **50 BCE–1 BCE**.
- Verified locally: Flower connections (edges attach to nodes; hub gold border); Flower journey epoch “50 BCE–1 BCE”. Tests 38/38.

### 2026-09-20 (Connections graph: no mid-edge labels)

- Removed the floating “N shared works” labels on the hub edges. Count still sits under each related-subject thumbnail.
- Hub–spoke lines are solid gold (were dashed/faint, so they disappeared on the dark field).
- Verified locally on `/subject/tulip/connections`: Flower and Bird connect to Tulip with visible lines; mid labels gone.

### 2026-09-20 (On-demand cache instead of 139k crawl)

- Stopped the overnight Collection API crawl (~2.6k artworks in). Replaced with: CSV **tag index** in `object_tags` (236,908 rows, 1,109 slugs, no Met API) + fetch/cache **8 objects per first visit**.
- Schema: `catalog_work_count` on `terms`; RLS read-only `object_tags`. Load: `npm run ingest:tags`.
- `ensureSubjectEnriched(slug)` uses service role: DB first, pick uncached IDs from the dump, GET `/objects/{id}`, upsert, rebuild that subject’s periods/connections.
- Search matches dump tags (not only journey_ready). Chair: 0 cached → 16 works, `journey_ready`, 1267–1880. Second visits skip once 8+ are cached.
- Flower/landscape/animal/bird stay journey_ready. Bulk `ingest:csv:all` is optional, not required.
- Verified: `npm test` 37/37; tag load; chair enrich; **not** claiming production Vercel has service_role yet.

### 2026-09-20 (Resume full Met catalog load)

- User asked to load **all** eligible Open Access objects (139,568), not the parked ~478-row slice.
- Did **not** set `MET_CSV_FRESH=1` — resumed from `csv-load-checkpoint.json` (`nextIndex` 480, existing `ingestion_runs` id).
- Hardened `scripts/ingest/load-csv.ts`: truncate only on fresh flag; skip IDs already in `artworks`; longer 403/HTML backoff; abort-and-retry a batch if ≥25% fetches fail (checkpoint does not skip those IDs); default concurrency 1 / gap 500ms; terms rebuild every 10k.
- `rebuildTermsAndLinks` now paginates `artworks`/`terms` so a full catalog is not capped at PostgREST’s 1000-row default. `finishIngestionRun` writes counts when the job ends.
- Supervisor `npm run ingest:csv:all` (`scripts/ingest/run-csv-load.sh`) retries on crash, then `ingest:connections`. Running under `caffeinate -i`.
- Verified live: progress 480 → 560; Supabase `artworks` 478 → 558, all with `image_url`; ETA ~31h. **Not complete** — machine must stay awake; terms/connections rebuild still pending at end.

### 2026-09-19 (Homepage + Journey/Connections polish)

- Unified product name **The Met Archive**; rebuilt home with search-first hero, ambient constellation imagery, featured subject (Journey + Connections CTAs), editorial subject rows, provenance line; no autofocus.
- Journey: nav shortened to Journey / Connections; catalog-subject framing; date formatting (`5 BCE`, `ca. 1770`); cap ≤3 works/period.
- Connections: shared-works language (hide scores); stronger shared strip + Open Journey CTA.
- Removed dead `WorksView` / `JourneyView`; PRD/brief/README no longer treat All Works as a product page.
- Added `src/lib/formatDate.ts` + Vitest.

### 2026-09-19 (Two-page constellation UI)

- Replaced three-view light UI with dark archival shell (EB Garamond / Manrope / JetBrains Mono; gold on charcoal tokens from design mocks).
- Page 1: `ChronologyConstellation` on `/subject/[slug]/journey` — featured period works as dated nodes + SVG chronological edges; epoch scrubber; live compare chips from `term_connections`; `?artwork=` inspection focus.
- Page 2: hub-and-spoke `ConnectionsView` on `/connections` — related subjects with sample images and shared-count edge labels.
- Dropped All Works from nav; `/works` redirects to journey. `getArtworksByIds` selects `image_url` / `image_url_small`.
- Verified: `npm test` 29/29; `npm run build` OK; local smoke flower/landscape/animal journey+connections 200; flower journey API 6 chapters / 18 featured with Met `imageUrl`; connections edges present; HTML includes Chronological Journey / Subject lens / Current subject.
- Layout fix: constellation sizes to the viewport and spreads nodes by chronological rank with min-gap + overlap separation so tight date clusters (e.g. 1800–1849) no longer pile on the left.
- Removed chronological edge labels (shared medium/type text on paths).
- Chrome cleanup: epochs moved to bottom footer; removed compare chips / “X plotted” / header subtitle+stats; subject title lives in the canvas banner; search suggestions no longer open on reload.

### 2026-09-19 (Park full Met CSV load)

- Wrote [docs/parked-met-csv-load.md](docs/parked-met-csv-load.md): symptoms, root cause (CSV needs live object fetch; Incapsula 403; job durability), tried mitigations, checkpoint ~480/139568, resume runbook.
- Decision: stop fighting the bulk enrich for now; keep Subject Museum on the working partial/API-slice index (flower/landscape/animal journey_ready).
- Verified: docs only; no ingest or UI changes in this pass.

### 2026-09-19 (Full Met Open Access CSV → Supabase)

- Added `admin_truncate_index()` RPC migration; gitignored `MetObjects.csv` + checkpoints.
- Pipeline: `ingest:download` → `ingest:csv-filter` (484956 rows → **139568** eligible PD+tags+date) → `ingest:csv` (API enrich + upsert + term rebuild) → `ingest:connections`.
- Shared write path: `scripts/ingest/upsert-index.ts`; API slice `ingest` uses it too. Helper: `npm run ingest:rebuild-terms`.
- Eligible IDs ordered with launch-tag priority (~35k first). Load runs with concurrency 1 + Incapsula 403 backoff (`data/met/csv-load.log`).
- Mid-load verify: **319** artworks upserted so far; flower/landscape/animal/bird `journey_ready`; connections edges flower=5 landscape=1 animal=2. Full 139568 remaining via checkpoint resume.
- Images remain hotlinked Met JPEGs (CSV has no image URLs).

### 2026-09-19 (Phase 4 — Met index refresh)

- Ingest upsert now writes `image_url` / `image_url_small` (keeps JPEG in `image_id` as fallback).
- Added `npm run ingest:refresh` (`scripts/ingest/refresh.ts`) to re-fetch existing Met `source_id`s; records `ingestion_runs` with `source_version=api-v1-refresh`.
- Connections eligibility accepts any of `image_url_small` / `image_url` / `image_id`.
- Documented soft refresh / expand slice / clean-reload TRUNCATE paths in README + IMPLEMENTATION_PLAN (status: Phase 4 complete).
- Verified soft refresh on live index: 98 Met rows → updated 80, fetchFailed 18, skipped 0; 80 rows with non-null `image_url`/`image_url_small`.
- Re-ran `ingest:connections`: flower/landscape/animal remain `journey_ready` (edges 2/3/1; smaller graph after partial fetch failures). Production `/api/subjects/flower/journey` 200 with Met JPEG `imageUrl`.

### 2026-09-19 (apply Met pivot DDL live)

- Applied schema from `supabase/migrations/20260919140000_met_pivot.sql` on project `soavlmfrtmobmgesccrp` via SQL Editor (Supabase MCP `apply_migration` unavailable this session).
- Ran DDL only: `source` default → `met`; added `artworks.image_url` / `image_url_small`; added `evidence_source` enum value `tag`.
- Skipped file `TRUNCATE` so the live Met index (flower/landscape/animal) stayed intact.
- Verified: `has_image_url=true`, `has_image_url_small=true`, `source_default='met'::text`, `has_tag_enum=true`.

### 2026-09-19 (Met Subject Museum pivot)

- Replaced AIC as launch source with The Met Collection API + Open Access ingest path ([metmuseum.github.io](https://metmuseum.github.io/)).
- Docs: brief, PRD, implementation plan, content-audit, README retargeted to Met JPEG hotlinks (no IIIF / Storage mirror for runtime).
- Schema migration file `20260919140000_met_pivot.sql` (image_url columns + truncate); live DDL applied in follow-up note (TRUNCATE skipped).
- Ingest: `npm run ingest` searches `/v1.1` for flower/landscape/animal, fetches objects, upserts `artworks`/`terms`/`artwork_terms`; attaches query as tag. Connections/periods recomputed.
- Launch: flower, landscape, animal `journey_ready`; journey APIs return `imageUrl` on `images.metmuseum.org` (HTTP 200 JPEG). UI `ArtworkImage` uses `src={imageUrl}`.
- Verified local + production: flower/landscape/animal journey_ready with Met JPEG `imageUrl`s; https://museum-exhibition-iota.vercel.app

### 2026-09-19 (Met throwaway POC)

- AIC IIIF still blocked by Cloudflare; Met `images.metmuseum.org` JPEGs return HTTP 200 with CORS `*`.
- Throwaway: `scripts/poc/met-seed.ts` searches Met `/v1.1/search?q=flower`, upserts into `artworks` (`source=met`, JPEG URL in `image_id`).
- Page: `/poc/met` reads those rows and displays `<img>` from Met CDN. Not wired into the main subject museum UI.

### 2026-09-19 (IIIF mirror → Supabase Storage)

- Cloudflare blocks artic.edu IIIF hotlinks (and Vercel upstream fetch). AIC docs allow polite scrape when storing locally.
- Rewrote `scripts/ingest/images.ts` (fetch `/full/843,/0/default.jpg`, 1s delay, upload `iiif/{id}/843.jpg`); no Playwright.
- Added `.github/workflows/mirror-iiif.yml` (`workflow_dispatch` + weekly). UI `ArtworkImage` loads public Storage URLs.
- Removed `/api/iiif` proxy route. Documented secrets + workflow in README.

### 2026-09-19 (Phase 3 — UI on indexed data)

- Replaced Met home with subject search + flower teaser. Added `/subject/[slug]/{journey,works,connections}` with shared shell (switcher, share, `?artwork=` inspection).
- Server layer: `src/lib/supabase/server.ts`, `src/lib/aic/iiif.ts`, `apiTypes`, `subjectUrlState` (+ Vitest), `queries.ts`.
- BFF: `/api/subjects`, `/api/subjects/[slug]/{journey,works,connections}`, `/api/artworks/[sourceId]`.
- UI: ArtworkImage, SubjectSearch autocomplete, JourneyView chapters, WorksView filters in URL, ConnectionsView ranked list + CSS radial, focus trap / Escape / reduced-motion.
- Fixed broken `scripts/ingest/run.ts` notes template so `next build` typechecks.
- Set Vercel env `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`; deployed preview then production.
- Verified local + production smoke: flower (84), landscape (72), animal (71) journey_ready; journey/works/connections/pages 200; IIIF imageIds present; autocomplete `q=flow` → flower. Live: https://museum-exhibition-iota.vercel.app
- Not done: Phase 4 refresh; OpenSeadragon; deleting Met gallery files; manual image relevance review.

### 2026-09-19 (Phase 2 — term connections + periods)

- Added `src/lib/aic/connections.ts` + `periods.ts` with Vitest coverage; script `npm run ingest:connections`.
- Loaded qualifying artwork_terms (PD + image + dated); cosine co-occurrence; min 3 shared; top 8 per journey_ready source; generics/aliases dropped.
- Upserted 786 `term_connections` and 881 `term_periods` rows. Launch subjects flower/landscape/animal each have 8 edges; SQL confirmed min shared ≥ 3 and sample IDs in intersection.
- Verified: unit tests; Supabase spot-checks. UI for Connections still Phase 3.

### 2026-09-19 (Phase 1 — Supabase + getting-started ingest)

- Linked Supabase project `soavlmfrtmobmgesccrp` (org museum-project; empty ACTIVE_HEALTHY). Applied migrations for six tables + RLS + FTS/trgm.
- Downloaded AIC getting-started (`allArtworks.jsonl`, `someArtworks.csv`). Enriched 1222 IDs via live API; upserted artworks/terms/artwork_terms; validation statuses stored.
- Idempotent re-load kept 1222 artworks. Journey-ready examples: flower, landscape, animal, vessel, portrait, tree, water, bird, horse.
- Revoked temporary anon write policies. Content audit + README + implementation plan Phase 1 marked complete.
- Verified: vitest aic tests; SQL status counts (journey_ready / browse_only / unavailable). Manual image relevance review not done.
- Not done: Phase 2 connections; UI on index; full dump; service_role in user env.

### 2026-09-19 (docs: AIC-only retarget)

- Rewrote `docs/IMPLEMENTATION_PLAN.md` for Art Institute dump → Supabase phases (ingest → connections → UI → refresh). Removed Met API locked decisions and exhibition-maker phases.
- Replaced `docs/content-audit.md` with an AIC dump audit template (not yet run).
- Cleaned Met-as-launch / previous-direction framing from `docs/PROJECT_BRIEF.md` and `docs/prd.md`. Launch source is AIC only; second museum out of scope for v1.
- Verified: documentation only. Ingest and UI replacement not started. Existing `src/` Met code remains previous-direction until Phase 3 UI work.

### 2026-09-19 (product pivot — docs only)

- Replaced `docs/PROJECT_BRIEF.md` and `docs/prd.md` with the searchable subject-museum concept: AIC dump → Supabase (`artworks`, `terms`, `artwork_terms`, `term_connections`, `ingestion_runs`, `term_periods`); core pages Journey / All Works / Connections; validation bands; shareable URL state.
- PRD milestones recast as: (1) Supabase + ingest, (2) compute connections, (3) UI on indexed data, (4) index-as-cache refresh. Functional IDs F01–F11 and backend IDs B01–B09 replace the Met exhibition-maker requirements.
- Explicitly marked Met three-work maker as previous direction. Live app and code unchanged. `docs/IMPLEMENTATION_PLAN.md`, `docs/content-audit.md`, and `data/subjects.json` not rewritten in this pass — treat as superseded for product scope until AIC ingest work begins.
- Verified: documentation only. No schema, ingest script, or UI changes. New app not claimed implemented.

### 2026-09-18

- Moved the build log from `docs/BUILD_LOG.md` to the repo root so it matches the assessment deliverable.
- Linked related docs from the new path (`docs/PROJECT_BRIEF.md`, `docs/prd.md`, `docs/IMPLEMENTATION_PLAN.md`).
- Added a project rule to update this file after every meaningful change, not only at phase end.
- Switched museum source to The Met Collection API (no key). Retargeted brief, PRD, and implementation plan off AIC.
- Live-audited windows, chairs, bowls, and hands. Locked default subject `windows` with IDs `9817, 14808, 453573, 5497, 14807, 5496, 444829, 444826, 436896`.
- Wrote `data/subjects.json` and `docs/content-audit.md`. Phase 1 exit criteria met; ready for Phase 2 vertical slice.

### 2026-09-18 / 2026-09-19 (Phase 2)

- Scaffolded Next.js App Router + Vitest; `GET /api/exhibitions` with Met parallel fetches and gallery UI (skeletons, empty, error+retry).
- Raised exhibition upstream budget to ~25s / ~20s per object for Met latency.
- `npm test` 8/8; `npm run build` OK.
- Deployed to Vercel production: https://museum-exhibition-iota.vercel.app (also deployment URL `museum-exhibition-5x03uqhqb-natecodes-projects.vercel.app`).
- Production smoke: three Windows works (9817, 14808, 453573); invalid subject rejected.

### 2026-09-19 (Phase 3)

- Published chairs (9 Met IDs; default 221/230/269).
- Added `/api/artworks`, `/api/replacements`, URL state module, Met cache (`revalidate: 3600`) + retry/backoff.
- Gallery: subject switch, title edit, replace, reorder, copy link, inspection modal, invalid/partial recovery.
- Vitest 17 passing; redeployed production https://museum-exhibition-iota.vercel.app; shared URL title reconstructs.
