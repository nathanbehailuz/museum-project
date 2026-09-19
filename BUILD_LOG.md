# Build Log: Subject Museum

Assignment: Creative, API-Integrated Web App
Related documents: [Project brief](docs/PROJECT_BRIEF.md), [PRD](docs/prd.md), [Implementation plan](docs/IMPLEMENTATION_PLAN.md), [Content audit](docs/content-audit.md)

Working log at the repo root. Update after every meaningful change, not only at phase end. Do not claim unchecked work passed.

## Goal & scope decision

**Current product (docs pivoted 2026-09-19):** a searchable digital museum. Visitor types a validated subject, follows a chronological Journey, browses All Works, explores Connections (catalog co-occurrence), inspects artworks, and shares URL state. Pitch: *Type a thing. See how artists have pictured it across time.*

Primary source: Art Institute of Chicago official dump → normalize/validate → Supabase index; app reads the index via Next.js BFF; IIIF image URLs (no image binaries in Storage). Advanced features: ingest + validation + BFF; signature motion; shareable URL + server-backed autocomplete.

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
- Met pivot live DDL applied without TRUNCATE; existing rows may still hold JPEG URLs in `image_id` until a reload writes `image_url` / `image_url_small`.

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
| 4. Polish and verify | | |
| 5. Release and document | | |
| Total | ~12–14.5 h | Through AIC Phase 3 |

## Session notes

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
