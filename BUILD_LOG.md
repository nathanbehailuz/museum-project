# Build Log: Museum Exhibition Maker

Assignment: Creative, API-Integrated Web App
Related documents: [Project brief](docs/PROJECT_BRIEF.md), [PRD](docs/prd.md), [Implementation plan](docs/IMPLEMENTATION_PLAN.md), [Content audit](docs/content-audit.md)

Working log at the repo root. Update after every meaningful change, not only at phase end. Do not claim unchecked work passed.

## Goal & scope decision

Building a small exhibition maker: a visitor opens a complete three-work show of everyday subjects in art, inspects works, replaces and reorders them, names the show, and shares a URL that reconstructs it.

Using The Met Collection API for live metadata and open-access JPEG images, with a manually reviewed ID pool for visual relevance. No API key. Primary advanced feature is a Next.js backend-for-frontend with validation, cache, retry/backoff, and graceful upstream failure. Shareable URL state is a required product capability, not the assessment's optional search feature.

Left out to keep the product small: accounts, database, private collections, multiple museums, catalog search, essays, annotation, zoom, drag-and-drop, editorial prompts, and downloadable exhibition images. Launch with one verified subject (`windows`); add chairs/bowls only after the core journey works. Hands needs a wider ID hunt.

## Stack & tooling

Chosen, not yet scaffolded:

- Next.js App Router and route handlers as the BFF. UI calls app routes, not the museum API.
- The Met Collection API (`collectionapi.metmuseum.org`) plus `images.metmuseum.org`.
- Deploy target: Vercel.
- Cursor as the implementation assistant. Motion: CSS FLIP / View Transitions (no library unless Phase 4 needs it). Test runner TBD in Phase 2.

## Key decisions & trade-offs

- Decision: switch from Art Institute of Chicago to The Met Collection API because it requires no key and exposes direct JPEG URLs. Alternative considered: keep AIC; rejected after product direction chose Met.
- Decision: reviewed artwork ID pools plus live metadata, because keyword/tag search often matches catalog text without showing the subject, and Met `hasImages=true` does not guarantee open-access images. Alternative considered: live search-only; rejected for visual relevance.
- Decision: BFF route handlers as the advanced feature, because the assessment needs a real client/server boundary, validation, cache, and upstream resilience. Alternative considered: client-only museum calls; rejected.
- Decision: shareable URL as source of truth, no required local storage or accounts. Alternative considered: save exhibitions server-side; out of scope.
- Decision: default subject `windows` with nine Met object IDs; default exhibition `[9817, 14808, 453573]`. Config in `data/subjects.json`.
- Decision: cache successful normalized metadata for 1 hour on Vercel via Next.js/`fetch` cache; never cache failures as success.
- Decision: ~8s upstream deadline, at most two retries on network/429/5xx, backoff, honor Retry-After within the deadline.
- Decision: use `/public/collection/v1.1/search` now; `/v1/search` retires 1 Oct 2026.

## Hard parts / dead ends

- Met object endpoint is often slow (~15–25s cold). Parallel batches with short timeouts failed; longer per-request timeouts and small parallel batches worked. Phase 2/3 timeout budget must reflect this.
- First “windows” tag search returned many Tiffany design drawings that were not public domain and had no `primaryImage`. Had to switch to stained-glass / architectural window queries.
- Object 1457 is titled “Casement Window” but its primary image did not clearly show a window; excluded after visual review.

## How I verified it works

Phase test cases live in the implementation plan. Record pass/fail and gaps here.

| Phase | Status | Result |
| --- | --- | --- |
| 1. Confirm scope and content | Complete | P1-1–P1-4 passed. Met live audit; `windows` locked with 9 IDs; decisions recorded; docs retargeted off AIC. |
| 2. Vertical slice and first deploy | Not started | |
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

## Known limitations

- Only one published subject so far (`windows`). Chairs and bowls look viable; hands needs more eligible IDs.
- Met object latency can be high; uncached first loads may feel slow until Phase 3 caching lands.
- No app code yet — Phase 1 is content and decisions only.

## Time spent

| Phase | Time | Notes |
| --- | --- | --- |
| 1. Confirm scope and content | ~1.5–2 h | Docs earlier; Met audit, visual review, config, doc retarget |
| 2. Vertical slice and first deploy | | |
| 3. Curation, inspection, and sharing | | |
| 4. Polish and verify | | |
| 5. Release and document | | |
| Total | ~1.5–2 h | Phase 1 only |

## Session notes

### 2026-09-18

- Moved the build log from `docs/BUILD_LOG.md` to the repo root so it matches the assessment deliverable.
- Linked related docs from the new path (`docs/PROJECT_BRIEF.md`, `docs/prd.md`, `docs/IMPLEMENTATION_PLAN.md`).
- Added a project rule to update this file after every meaningful change, not only at phase end.
- Switched museum source to The Met Collection API (no key). Retargeted brief, PRD, and implementation plan off AIC.
- Live-audited windows, chairs, bowls, and hands. Locked default subject `windows` with IDs `9817, 14808, 453573, 5497, 14807, 5496, 444829, 444826, 436896`.
- Wrote `data/subjects.json` and `docs/content-audit.md`. Phase 1 exit criteria met; ready for Phase 2 vertical slice.
