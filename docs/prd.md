# PRD: Subject Museum

Status: Draft for implementation (product pivot)
Assignment: Creative, API-Integrated Web App
Related documents: [Project brief](PROJECT_BRIEF.md), [Implementation plan](IMPLEMENTATION_PLAN.md), [Content audit](content-audit.md)
Implementation budget: assessment time box; prioritize a complete journey with a small reviewed collection

Launch museum: **Art Institute of Chicago** only. Subjects and artwork IDs come from dump validation into Supabase, not from a hand-curated object-ID menu.

## 1. Product Goal

Help a curious visitor notice everyday subjects in art by searching a validated subject index, following a chronological visual history, inspecting works, exploring catalog co-occurrences, and sharing the current view.

The first screen is usable search with an example journey in sight. A visitor should complete a meaningful visit in a few minutes, without an account or knowledge of collection-search syntax.

One-sentence pitch: **Type a thing. See how artists have pictured it across time.**

## 2. Scope And Priorities

All requirements in section 4 are release requirements. Deliver a complete subject journey (search → Journey → inspect → All Works or Connections → share) before expanding optional features.

Launch with at least three journey-ready subjects **discovered from the Art Institute dump** after validation. Subjects are not limited to a predetermined menu; autocomplete exposes validated terms from Supabase.

Optional after release requirements pass: richer IIIF zoom, visitor-curated exhibitions, embeddings for related-subject suggestions, downloadable Journey images, All Works grid/list toggle.

Out of scope: accounts, private collections, multiple museums in v1, visitor-authored essays, computer-vision detection, copying image binaries into Supabase Storage, inventing art-historical interpretations the museum did not provide.

## 3. Main User Journey

1. Open search; see suggestions from the validated subject index and an example journey.
2. Select a journey-ready subject (or learn why a query is browse-only / unavailable and pick a nearby valid subject).
3. Move through Journey chapters chronologically; inspect a work and return to the same position.
4. Switch to All Works; sort or filter; inspect again without losing filters or scroll.
5. Open Connections; select a related term; view shared works; optionally continue into that subject’s Journey.
6. Copy a link and reconstruct the same page state in a fresh browser session.

## 4. Functional Requirements And Acceptance Criteria

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| F01 | Home search | First visit shows a prominent search field and at least one example journey-ready subject without marketing onboarding. Artwork-shaped skeletons preserve layout while data loads. |
| F02 | Debounced autocomplete | Typing queries validated subjects from Supabase (FTS or trigram). Suggestions show useful context (work count, year span). Singular/plural aliases resolve to the canonical term. Debounce is server-backed. |
| F03 | Subject status handling | Journey-ready subjects open Journey. Browse-only subjects open a compact results path or clear explanation, never a full chronological journey. Unavailable queries explain the reason in plain language and suggest nearby valid subjects. |
| F04 | View switcher | For a selected subject, Journey / All Works / Connections share search, subject header, inspection, and URL state. Switching views does not require a new search. |
| F05 | Journey narrative | Journey is the default subject page. Chapters are data-derived periods (from dates / `term_periods`), not hardcoded art-history labels. Works appear chronologically; dense subjects show a representative subset (≥8 qualifying works for journey-ready). Factual summaries only (counts, media, years). No duplicate artworks in a journey. |
| F06 | All Works browse | Complete qualifying set via `artwork_terms` ⋈ `artworks`. Image-first grid/masonry preserving proportions. Sort by date, relevance, artist, or title. Filter by date range, source, artwork type, medium, and artist when fields exist. Filters live in the URL. Pagination or cursor loading; skeletons; preserve filters and scroll after closing inspection. Evidence label shows why the work matched (e.g. `Museum subject: window`). |
| F07 | Connections graph | Four to eight strong related terms from `term_connections`. Edges reflect shared qualifying works and normalized score; sample artwork previews from the intersection. Selecting a related term updates a shared-works strip. Visitor can open related Journey, intersection All Works, or return. Keyboard and ranked-list alternatives expose the same relationships without requiring a spatial graph. Copy states that connections come from shared museum metadata. |
| F08 | Artwork inspection | Shared across pages: large image, title, artist, date, medium, museum, metadata tags, optional sanitized museum description, link to original record. Close returns focus and restores originating page, filters, selected connection/period, and scroll. Missing metadata uses neutral fallbacks, never invented facts. Zoom (if shipped) has buttons and reset, not gesture-only. |
| F09 | Shareable URL state | Share copies a URL encoding subject, page (journey/works/connections), filters, active period or connection, and selected artwork. Fresh session reconstructs that state via validated server requests. URL is source of truth; local storage optional for last visit only. |
| F10 | URL navigation | Committed changes update URL without full reload where appropriate. Back/forward restores matching state. Invalid subjects, filters, or artwork IDs show recovery, never a silently different subject presented as the shared result. |
| F11 | Responsive layouts | Desktop: Journey horizontal timeline; All Works dense grid; Connections network with list fallback. Mobile: Journey vertical timeline; All Works 1–2 columns; Connections ranked list (optional compact graph); full-screen inspection. Images remain uncropped within sensible height limits. |

## 5. API And Backend Requirements

Primary source: [Art Institute of Chicago](https://api.artic.edu/docs/) official **data dump** for bulk ingest. Live API for bounded detail refresh and fallback only—not for bulk scraping. Construct IIIF image URLs; do not store image files in Supabase Storage.

Use Next.js route handlers as a BFF. UI components request normalized data from application routes. Supabase holds the validated index. Service-role credentials stay server-side; public clients use only intended views or RPCs with RLS.

Suggested tables: `artworks`, `terms`, `artwork_terms`, `term_connections`, `ingestion_runs`, `term_periods`.

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| B01 | Dump ingest | Script downloads/processes the official dump, normalizes records, extracts candidate terms, upserts into Supabase. Keyed by `(source, source_id)`. Rerunning the same source updates rather than duplicates. Each run recorded in `ingestion_runs`. |
| B02 | Subject validation | Every candidate term receives a stored status and rejection/acceptance reasons against the brief’s hard requirements (language, exact catalog evidence in `subject_titles`/`term_titles`, displayable image, public domain, dated record, min depth, temporal breadth, creator diversity; presentational diversity as ranking). Title/description alone cannot qualify an artwork. |
| B03 | Status bands | Terms are journey-ready, browse-only, or unavailable per brief thresholds (adjustable after dump analysis). Autocomplete promotes journey-ready; browse-only and unavailable behave per F03. |
| B04 | Term connections | Precompute edges with ≥3 shared qualifying artworks, cosine-style score `shared / sqrt(count_A * count_B)`, alias removal, generic-term exclusion/downweight, strongest edges retained per subject, sample artwork IDs stored. Edges verifiable against shared artwork IDs. |
| B05 | Journey periods | Precompute or derive chapter boundaries, counts, and featured artwork IDs (`term_periods` or equivalent) so Journey loads are stable and fast. |
| B06 | Serve from index | Routes for autocomplete, Journey, All Works, Connections, intersections, and artwork detail read Supabase. All Works does not rerun fuzzy museum search per visit. Return a small, stable response shape with source attribution. |
| B07 | Live API fallback | Optional refresh of a single record from the live museum API with caching, bounded timeout, retry/backoff on transient failures. Document what is precomputed vs runtime. Failures are not cached as success. |
| B08 | Credentials and RLS | Service role / secrets never exposed to the browser. Public read limited to intended tables/views/RPCs. `.env.example` documents `NEXT_PUBLIC_SUPABASE_URL`, publishable key, and server-only service role (placeholders only). |
| B09 | Graceful failure | Consistent errors map to empty, unavailable-index, and upstream-unavailable UI states. Distinguish missing indexed data from museum/Supabase outage. Existing content remains usable where possible during recoverable refresh failure. |

Endpoint names are proposals (`GET /api/subjects?q=`, `GET /api/subjects/{slug}/journey|works|connections`, `GET /api/artworks/{id}`, `GET /api/artworks?terms=`). Final contracts belong in the implementation plan and README as implemented.

## 6. Design, Accessibility, And Performance

Unframed art-book composition; artworks as the main visual signal; uncropped images; compact controls; expressive serif for titles; readable sans for labels; color primarily from the art. Avoid dashboard cards, ornate frames, heavy shadows, and fake wall textures.

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| N01 | Responsive layout | Verify at 375px, 768px, and 1440px. No horizontal page overflow, overlapping text, or inaccessible controls. Layouts match F11. |
| N02 | Accessibility | Semantic markup, labeled inputs, named icon controls, visible focus, informative image alternatives, accessible status messages. Connections relationships available without interpreting a spatial graph. All required workflows work without a pointer. |
| N03 | Signature motion | Coordinated chapter advance on Journey and/or shared-element / FLIP-style transition into inspection, mainly transform and opacity. `prefers-reduced-motion` removes or simplifies motion. Inspection remains usable without animation. |
| N04 | Loading and stability | Artwork-shaped skeletons for subject and page loads; static placeholders under reduced motion. Reserve image space; preserve proportions; size images for rendered dimensions. |
| N05 | Performance evidence | Aim for fluid interactions on a mid-range profile. Record a production Lighthouse mobile run (project target ~85); disclose results and limitations. Investigate material layout shift or scrolling jank. |

## 7. Required States

| Trigger | Expected behavior |
| --- | --- |
| Initial or subject fetch | Stable skeletons and an accessible loading status. |
| No / insufficient indexed content | Clear empty or browse-only / unavailable explanation with nearby valid subjects when possible. |
| Invalid or unknown subject in URL | Recovery state; never silently swap to a different subject as if it were the shared result. |
| Supabase / index failure | Recoverable error with retry; distinguish from “subject not in index.” |
| Upstream museum failure (detail refresh) | Retain indexed content where available; explain refresh failure. |
| Image delivery failure | Preserve label and image space; image-unavailable fallback; museum record link still available. |
| Connections with few edges | Show available relationships or an honest empty state; do not invent nodes. |
| Clipboard unavailable | Display the full selectable sharing URL. |
| Rapid search or subject changes | Ignore or cancel stale responses so the last committed selection wins. |

## 8. Assessment Coverage

| Assessment requirement | Planned evidence |
| --- | --- |
| Third-party API | AIC dump + live API fallback; IIIF images; quirks documented. |
| Creative, distinctive UI | Search home, Journey timeline, All Works grid, Connections, inspection; mobile screenshots. |
| Smooth motion and performance | Signature transition, reduced-motion path, production performance notes. |
| Proper states | Loading, empty, browse-only/unavailable, index vs upstream error, image failure. |
| Good practices | Client/server boundary, validation, RLS/credentials, accessibility, responsive behavior, no committed secrets. |
| At least one advanced feature | Primary: ingest, validation, Supabase index, BFF routes. Secondary: signature animation if verified. |
| Shareable state | URL-encoded subject/page/filters/period/connection/artwork plus debounced server-backed subject search. |
| Documentation | README and BUILD_LOG explain architecture, what is precomputed vs runtime, how to reproduce ingest, testing, limitations. |
| Time and scope discipline | Log time per phase; stop at the time box; report gaps honestly. |

Assessment weights (product quality, technical judgment, creative problem solving, communication, speed) favor a working polished core and evidence of decisions.

## 9. Implementation And Deployment Milestones

Build order and detailed test cases belong in a rewritten [implementation plan](IMPLEMENTATION_PLAN.md). This table is the product-level gate only: do not start the next phase until the current exit criterion is true.

```text
IngestAndValidate → ComputeConnections → UIOnIndexedData → RefreshAsCache
```

| Phase | Exit criterion |
| --- | --- |
| 1. Supabase + ingest | Supabase project and migrations for the six tables exist. Dump (or documented sample slice) is cleaned, normalized, and upserted. Validation statuses and rejection reasons are stored. Sample load is reproducible; rerunning is idempotent. At least three journey-ready candidates identified for review. |
| 2. Compute connections | `artwork_terms` pairs yield `term_connections` with scores, shared counts, sample artwork IDs. Generics/aliases handled. Edges verified against shared artwork IDs for launch subjects. |
| 3. UI on the index | Home search + Journey + All Works + Connections + shared inspection + shareable URL state for ≥3 journey-ready subjects. Routes read Supabase. Signature transition implemented enough to demo. Loading/empty/error states present. Deployed preview shows real indexed data and IIIF images. |
| 4. Index as cache + refresh | Re-ingest / manual (or scheduled) refresh documented and runnable. Live detail refresh with cache and backoff where implemented. UI distinguishes stale/missing index data from upstream outage. Docs and `.env.example` match the implemented stack. |

Deploy a vertical UI slice as soon as phase 1–2 data exists (during phase 3), not only at the end. Redeploy meaningful milestones and verify the final production URL before submission.

## 10. Verification Plan

Phase-level checks belong in the implementation plan. Strategy:

- Automate: term normalization/aliases, validation status rules, ingest upsert idempotency fixtures, connection score/filtering, URL parse/serialize, route validation bounds.
- Live/manual: dump ingest against real (or sample) AIC data; IIIF image checks; autocomplete; Journey/All Works/Connections flows; inspection return state; shared URLs in a fresh session; keyboard, focus return, reduced motion; 375 / 768 / 1440 widths.
- Failure: simulate Supabase errors and museum detail-refresh failures; confirm distinct UX.
- Capture actual results and gaps in root `BUILD_LOG.md`. Run production build, lint, and type checks where configured.

## 11. Deliverables And Release Gate

- Working live URL, verified in a fresh browser session.
- Public or reviewer-accessible repository for this project.
- Root README.md: features, zero-to-run setup, dump ingest reproduction, API quirks, architecture (precomputed vs runtime), advanced feature, testing, limitations.
- Root BUILD_LOG.md maintained during each phase.
- Root `.env.example` with Supabase placeholders only (no real secrets).
- docs/PROJECT_BRIEF.md, this PRD, docs/IMPLEMENTATION_PLAN.md, and docs/content-audit.md filled with AIC dump results and launch subjects.
- Optional walkthrough video: one proud implementation detail, one hard part or shortcut.
- Shared final submission document with live, repo, and video links.

Release only after the main journey works on the deployed site, the BFF/ingest advanced feature has evidence, required states have been checked, and docs match the implementation. If the time box ends first, submit an honest account of completed scope and gaps. Confirm reviewer access before final submission lock.

## 12. Provisional Product Decisions

Locked for planning unless dump analysis forces adjustment (record changes in BUILD_LOG):

| Decision | Choice |
| --- | --- |
| Launch museum | Art Institute of Chicago — official dump for bulk ingest; live API for bounded refresh |
| Images | IIIF URLs from museum; no image binaries in Supabase Storage |
| Rights | Public domain only for initial release |
| Index | Supabase Postgres: `artworks`, `terms`, `artwork_terms`, `term_connections`, `ingestion_runs`, `term_periods` |
| Launch subjects | ≥3 journey-ready terms discovered from data after validation + sample relevance review |
| Validation thresholds | Per brief (8+ works, 50+ year span, ≥3 buckets, ≥4 creators, ≤40% single maker on default journey, etc.); tune after dump analysis |
| Connections score | `shared / sqrt(n_A * n_B)`; min 3 shared works; exclude/downweight generics |
| App routes (sketch) | `/subject/{slug}/journey\|works\|connections` plus query params for artwork / filters / period / connection |
| BFF | Next.js App Router route handlers; UI does not call museum or service role from the browser |
| Deploy | Vercel (or equivalent) with env-based Supabase config |
| Motion | CSS transform/opacity FLIP or View Transitions; honor `prefers-reduced-motion` |
| Second museum | Out of scope for v1 |

Update this PRD when verified dump or API behavior changes scope or acceptance criteria.
