# Build Log: Museum Exhibition Maker

Assignment: Creative, API-Integrated Web App
Related documents: [Project brief](docs/PROJECT_BRIEF.md), [PRD](docs/prd.md), [Implementation plan](docs/IMPLEMENTATION_PLAN.md), [Content audit](docs/content-audit.md)

Working log at the repo root. Update after every meaningful change, not only at phase end. Do not claim unchecked work passed.

## Goal & scope decision

Building a small exhibition maker: a visitor opens a complete three-work show of everyday subjects in art, inspects works, replaces and reorders them, names the show, and shares a URL that reconstructs it.

Using The Met Collection API for live metadata and open-access JPEG images, with a manually reviewed ID pool for visual relevance. No API key. Primary advanced feature is a Next.js backend-for-frontend with validation, cache, retry/backoff, and graceful upstream failure. Shareable URL state is a required product capability, not the assessment's optional search feature.

Left out to keep the product small: accounts, database, private collections, multiple museums, catalog search, essays, annotation, zoom, drag-and-drop, editorial prompts, and downloadable exhibition images. Launch with one verified subject (`windows`); add chairs/bowls only after the core journey works. Hands needs a wider ID hunt.

## Stack & tooling

- Next.js 15 App Router + TypeScript; route handlers as the BFF.
- The Met Collection API (`collectionapi.metmuseum.org`) plus `images.metmuseum.org`.
- Vitest for route/helper unit tests.
- Deploy: Vercel — production https://museum-exhibition-iota.vercel.app
- Cursor as the implementation assistant. Motion: CSS FLIP / View Transitions (Phase 4). No env vars required.

## Key decisions & trade-offs

- Decision: switch from Art Institute of Chicago to The Met Collection API because it requires no key and exposes direct JPEG URLs. Alternative considered: keep AIC; rejected after product direction chose Met.
- Decision: reviewed artwork ID pools plus live metadata, because keyword/tag search often matches catalog text without showing the subject, and Met `hasImages=true` does not guarantee open-access images. Alternative considered: live search-only; rejected for visual relevance.
- Decision: BFF route handlers as the advanced feature, because the assessment needs a real client/server boundary, validation, cache, and upstream resilience. Alternative considered: client-only museum calls; rejected.
- Decision: shareable URL as source of truth, no required local storage or accounts. Alternative considered: save exhibitions server-side; out of scope.
- Decision: default subject `windows` with nine Met object IDs; default exhibition `[9817, 14808, 453573]`. Config in `data/subjects.json`.
- Decision: Phase 2 exhibition deadline ~25s total / ~20s per object (parallel). Locked ~8s was too aggressive for Met cold starts; full B05 retry/backoff stays Phase 3.
- Decision: cache successful normalized metadata for 1 hour on Vercel (implement in Phase 3); never cache failures as success.
- Decision: use `/public/collection/v1.1/search` now; `/v1/search` retires 1 Oct 2026.

## Hard parts / dead ends

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
| 2. Vertical slice and first deploy | Complete | Next.js gallery + `/api/exhibitions`; Vitest 8/8; production https://museum-exhibition-iota.vercel.app shows three live Windows works. |
| 3. Curation, inspection, and sharing | Not started | |
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

## Known limitations

- Only one published subject so far (`windows`). Chairs and bowls look viable; hands needs more eligible IDs.
- Met object latency can still make the first load feel slow; Phase 3 caching not implemented yet.
- No curation, share URL, inspection, or subject switching yet (Phase 3).
- Full README polish still Phase 5; Phase 2 README covers local setup and no-env note only.

## Time spent

| Phase | Time | Notes |
| --- | --- | --- |
| 1. Confirm scope and content | ~1.5–2 h | Docs earlier; Met audit, visual review, config, doc retarget |
| 2. Vertical slice and first deploy | ~2–2.5 h | Scaffold, BFF, gallery, tests, Vercel deploy friction |
| 3. Curation, inspection, and sharing | | |
| 4. Polish and verify | | |
| 5. Release and document | | |
| Total | ~3.5–4.5 h | Through Phase 2 |

## Session notes

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
