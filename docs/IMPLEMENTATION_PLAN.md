# Implementation Plan: Museum Exhibition Maker

Status: Phase 2 complete — ready for Phase 3
Related documents: [Project brief](PROJECT_BRIEF.md), [PRD](prd.md), [Content audit](content-audit.md)

This document is the build order and phase gate list. The PRD stays the product contract: what must be true. Do not copy task lists back into the PRD.

A phase is done only when its test cases pass. Do not start the next phase's product work until then. Record results and gaps in the root `BUILD_LOG.md` after every meaningful change, not only at phase end.

## Locked Decisions (Phase 1)

| Decision | Choice |
| --- | --- |
| Museum API | [The Met Collection API](https://metmuseum.github.io/) — no registration, no API key |
| Upstream base | `https://collectionapi.metmuseum.org` |
| Search | `GET /public/collection/v1.1/search` with `offset`/`limit` (`/v1/search` retires 1 Oct 2026) |
| Object | `GET /public/collection/v1/objects/{objectID}` |
| Images | Use `primaryImageSmall` (gallery) and `primaryImage` (inspect) from the object record; host `images.metmuseum.org` |
| Eligibility | `isPublicDomain === true` and non-empty `primaryImage`. Search `hasImages=true` is not sufficient. |
| Default subject | `windows` / title `Windows` |
| Launch pool | See [`data/subjects.json`](../data/subjects.json) — 9 reviewed IDs; default exhibition `[9817, 14808, 453573]` |
| App routes | `GET /api/exhibitions?subject=`, `GET /api/artworks?ids=`, `GET /api/replacements?subject=&exclude=` |
| Deploy | Vercel |
| Cache | Successful normalized metadata only; 1-hour TTL via Next.js/`fetch` cache on Vercel; never cache failures as success |
| Upstream resilience | Phase 2 exhibition route: ~25s total / ~20s per Met object (parallel). Full B05 backoff/Retry-After still Phase 3. Locked ~8s was too aggressive for Met cold starts. |
| Motion | CSS transform/opacity FLIP or View Transitions; no extra library unless Phase 4 needs it; honor `prefers-reduced-motion` |
| Env vars | None required for the museum API |
| Normalized artwork shape | `id`, `title`, `artist`, `date`, `medium`, `image` (`primary` + `small`), `isPublicDomain`, `objectURL` — mapped from Met `objectID`, `title`, `artistDisplayName`, `objectDate`, `medium`, `primaryImage`/`primaryImageSmall`, `isPublicDomain`, `objectURL` |
| Request courtesy | Optional identifying `User-Agent`; Met documents up to 80 req/s; still bound our own timeout/retry |

## Proposed Route Contracts

Names can change; document the implemented contracts in the README.

| Route | Purpose |
| --- | --- |
| `GET /api/exhibitions?subject=` | Default three eligible works for a supported subject. |
| `GET /api/artworks?ids=` | Normalized records for up to three reviewed IDs. |
| `GET /api/replacements?subject=&exclude=` | One eligible replacement not in the current selection. |

UI components call these routes, not the museum API. Image requests may go directly to `images.metmuseum.org`.

## Phase 1. Confirm Scope And Content

**Exit:** One default subject is verified, the launch pool is recorded, and this plan's open decisions are filled in.

**Status:** Complete. Tests P1-1–P1-4 passed. See [content-audit.md](content-audit.md) and root `BUILD_LOG.md`.

### Build, in order

1. Live-audit candidate subjects (windows, chairs, bowls, hands) against The Met API.
2. Choose the default subject and at least six visually relevant, public-domain, image-backed IDs.
3. Settle route contracts, cache, timeout/retry, and motion approach.
4. Write subject/ID config the backend can consume (`data/subjects.json`). No Next.js scaffold in this phase.
5. Keep the root `BUILD_LOG.md` current: goal, scope, stack, tool choices, and session notes.

### Test cases to pass

| ID | Check | How | Result |
| --- | --- | --- | --- |
| P1-1 | Default subject has at least six distinct eligible IDs. | Live API audit | Pass — 9 windows IDs |
| P1-2 | Every launch ID is public domain and has a usable primary image. | Live fetch of each ID | Pass |
| P1-3 | Each launch work visually shows the subject; title-only matches are rejected. | Manual image review | Pass |
| P1-4 | Open decisions above are recorded with the chosen values. | This doc + build log | Pass |

## Phase 2. Vertical Slice And First Deploy

**Exit:** A visitor can open the live URL and see three real works for the default subject, with loading and recoverable error behavior.

**Status:** Complete. Production: https://museum-exhibition-iota.vercel.app — see root `BUILD_LOG.md`.

### Build, in order

1. App shell, gallery layout, and artwork-shaped skeletons.
2. Subject/ID config consumed only by the backend.
3. Exhibition route: validate subject, fetch upstream, filter eligibility, normalize fields.
4. Gallery UI: three uncropped works with title, artist, and date.
5. Loading status, insufficient-content state, and retryable upstream failure.
6. Deploy. Verify metadata and images on the live URL before adding curation.

### Test cases to pass

| ID | Check | Covers | How | Result |
| --- | --- | --- | --- | --- |
| P2-1 | A visit with no URL state loads three distinct eligible works and the default title. | F01 | Browser, live | Pass |
| P2-2 | Each work shows an uncropped image, title, artist, and date; missing optional metadata uses a fallback, never invented facts. | F03 | Browser | Pass |
| P2-3 | Initial fetch shows artwork-shaped skeletons and an accessible loading status. | F01, N04, states | Browser | Pass |
| P2-4 | Unsupported subjects and malformed IDs are rejected by the route with no upstream call. | B01 | Automated | Pass |
| P2-5 | Records that are not explicitly public domain or lack a primary image never enter the exhibition. | B02 | Automated + live sample | Pass |
| P2-6 | Normalized payload contains only the fields the UI needs; optional fields may be absent. | B03 | Automated | Pass |
| P2-7 | Upstream timeout/outage shows a recoverable error with retry; no crash. | B06, states | Automated mock + live if needed | Pass |
| P2-8 | A pool with fewer than three usable works shows a clear empty/insufficient state. | B02, states | Automated or fixture | Pass |
| P2-9 | Layout holds at 375px, 768px, and 1440px with no page overflow. | N01 | Browser | Pass (local + production gallery) |
| P2-10 | Production URL shows live museum metadata and real images. | Assessment API | Deployed smoke | Pass |

## Phase 3. Curation, Inspection, And Sharing

**Exit:** The main journey works on the preview deployment: replace, reorder, title, inspect, copy a link, and reconstruct it in a fresh session.

### Build, in order

1. Artwork-by-IDs and replacement routes, including exclude-current-selection.
2. Replace a single slot; disable duplicate requests while pending.
3. Accessible move-left/move-right (adapt to vertical mobile order).
4. Titled input: 80-character cap, whitespace restores default title.
5. Inspection view with required fields and museum link. Motion can wait for phase 4.
6. URL encode/decode for subject, ordered IDs, and committed title.
7. Copy-link, clipboard fallback, and history rules (push on subject change, replace on in-place curation).
8. Invalid shared state and unavailable-work recovery.
9. Cache successful metadata; bounded retry/backoff for transient upstream failures.
10. Redeploy the preview.

### Test cases to pass

| ID | Check | Covers | How |
| --- | --- | --- | --- |
| P3-1 | Replacing one work keeps the other two and the title; replacement matches subject and is not already selected. | F04 | Browser |
| P3-2 | A pending replacement cannot issue a duplicate request; failure keeps the current work and offers retry. | F04, B06, B07 | Browser + automated |
| P3-3 | Move controls change order only; first/last boundary moves are disabled; keyboard works. | F05 | Browser, keyboard |
| P3-4 | Title accepts up to 80 characters; whitespace-only commit restores the subject default; text is not rendered as HTML. | F06 | Browser + automated |
| P3-5 | Inspection shows larger uncropped image, title, artist, date, medium, and museum record link. Close and Escape return focus to the opener; background is inert. | F07 | Browser, keyboard |
| P3-6 | Copy link encodes subject, three ordered IDs, and committed title. A fresh session reconstructs the same exhibition without local storage. | F08 | Browser, two sessions |
| P3-7 | Clipboard failure exposes a selectable URL; success is announced accessibly. | F08, states | Browser / mocked clipboard |
| P3-8 | Subject change pushes history; title and curation changes replace the current entry; back/forward restores matching state. | F09 | Browser |
| P3-9 | Unsupported subject, malformed/duplicate IDs, count ≠ 3, and oversized title show recovery, never a silently different exhibition. | F10 | Browser + automated parse tests |
| P3-10 | A missing or ineligible shared work identifies the slot, preserves remaining valid works and title, and offers replace or reset. | F11 | Browser / fixture |
| P3-11 | Changing subject loads that subject's default title and three distinct works. | F02 | Browser |
| P3-12 | Successful metadata is cached for the documented TTL; failures are not stored as success. | B04 | Automated |
| P3-13 | Transient 429/5xx/network failures retry at most twice with backoff; permanent 4xx is not retried; Retry-After is honored within the deadline. | B05 | Automated mocks |
| P3-14 | Preview deploy reconstructs a shared URL with live data. | F08 | Deployed smoke |

## Phase 4. Polish And Verify

**Exit:** Required states, accessibility, reduced motion, signature transition, and performance evidence are checked. Extra subjects only after the core passes.

### Build, in order

1. Remaining states: image-unavailable, rapid subject change, exhausted replacement pool.
2. Keyboard-only main journey, named controls, visible focus, status messages.
3. Reduced-motion path, then the inspection transition (transform/opacity).
4. Image sizing and layout stability during replacement.
5. Additional subjects only if each has six eligible, visually relevant works. Chairs and bowls looked strong in the Phase 1 sample; hands needs more IDs.
6. Production Lighthouse mobile run; note score and limitations.

### Test cases to pass

| ID | Check | Covers | How |
| --- | --- | --- | --- |
| P4-1 | Image delivery failure keeps label and image space, shows an unavailable fallback, and still links to the museum record. | states | Browser |
| P4-2 | Rapid subject changes ignore or cancel stale responses; last selected subject wins. | states | Browser |
| P4-3 | Exhausted pool or replacement error keeps the current work and explains the issue beside its controls. | states, F04 | Browser / fixture |
| P4-4 | Main journey works without a pointer; icon controls have accessible names; focus is visible. | N02 | Keyboard |
| P4-5 | Inspection transition uses transform/opacity; `prefers-reduced-motion` removes or simplifies it; inspection still works without motion. | N03 | Browser |
| P4-6 | Replacement does not shift unaffected works; images are sized for rendered dimensions. | N04 | Browser |
| P4-7 | Mobile is a vertical sequence with full-screen inspection; no overlapping text or inaccessible controls. | N01 | 375px |
| P4-8 | Production Lighthouse mobile run is recorded; investigate layout shift or scrolling jank. Target 85 is a project goal, not a pass/fail gate. | N05 | Production run |
| P4-9 | A second subject is published only if it meets F02 (six eligible, visually relevant works). | F02 | Live audit |

## Phase 5. Release And Document

**Exit:** Final production URL, docs, and submission links match the implemented product.

### Build, in order

1. Deploy the release candidate.
2. Run the live smoke of the main journey on the production URL.
3. Finish README, build log, `.env.example` or an explicit "no env vars" note.
4. Align this plan and the PRD with what actually shipped.
5. Optional walkthrough video: one proud detail, one hard part or shortcut.
6. Collect live, repo, and video links in the shared submission document.

### Test cases to pass

| ID | Check | How |
| --- | --- | --- |
| P5-1 | Fresh browser session completes the main journey on the production URL: default exhibition, replace, reorder, title, inspect, share, reconstruct. | Live smoke |
| P5-2 | Invalid and unavailable shared URLs recover as specified; retry still works after a simulated failure if feasible. | Live smoke |
| P5-3 | README covers features, zero-to-run setup, API quirks, architecture/caching, advanced feature, testing, and limitations. | Doc review |
| P5-4 | BUILD_LOG records decisions, verification results, gaps, tools used, and time per phase. | Doc review |
| P5-5 | No real secrets committed; `.env.example` is placeholders only, or docs state that no env vars are required. | Repo review |
| P5-6 | Production build, lint, and type checks pass where configured. | CI / local |
| P5-7 | Reviewer can open the live URL, repo, and optional video without extra access steps. | Link check |

## Mapping To PRD Verification

Keep automated tests around URL parse/serialize, bounds, eligibility, duplicate prevention, and retry/cache. Mock upstream failures. Run live museum checks separately.

The browser smoke in P5-1 is the same flow as PRD section 10. Capture actual results in the root `BUILD_LOG.md` rather than updating this checklist into a pass diary.
