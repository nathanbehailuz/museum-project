# PRD: Museum Exhibition Maker

Status: Draft for implementation
Assignment: Creative, API-Integrated Web App
Related documents: [Project brief](PROJECT_BRIEF.md), [Implementation plan](IMPLEMENTATION_PLAN.md)
Implementation budget: 2-4 hours, within the assessment's 6-10 hour total

## 1. Product Goal

Help a curious visitor notice everyday subjects in art by arranging, inspecting, naming, and sharing a three-work exhibition made from real museum records.

The first screen is the usable exhibition. A visitor should be able to create and share a variation in a few minutes, without an account or knowledge of collection search.

## 2. Scope And Priorities

All requirements in section 4 are release requirements. Deliver a small, complete experience before expanding the number of subjects or adding optional features.

Launch with one verified subject first. Expand to at most four subjects only when each has enough visually relevant, public-domain works with usable images. Windows, chairs, bowls, and hands are candidates, not confirmed launch content.

Optional after release requirements pass: zoom, drag-and-drop ordering, editorial prompts, downloadable exhibition images, and search.

Out of scope: accounts, database storage, private collections, multiple museums, full catalog browsing, essays, and annotation tools.

## 3. Main User Journey

1. Open a complete default exhibition.
2. Choose a supported subject.
3. Inspect an artwork and return to the gallery.
4. Replace individual works and change their order.
5. Give the exhibition a title.
6. Copy a link and open the same exhibition in a fresh browser session.

## 4. Functional Requirements And Acceptance Criteria


| ID  | Requirement                | Acceptance criteria                                                                                                                                                                                                                                                               |
| --- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F01 | Default exhibition         | A visit without URL state loads three distinct eligible artworks for the default subject, with a default title. During fetch, artwork-shaped skeletons preserve the gallery layout.                                                                                               |
| F02 | Verified subject selection | Only reviewed subjects are selectable. Each published subject has at least six eligible works, allowing three selections and replacement options. Changing subject resets to its default title and three distinct works.                                                          |
| F03 | Artwork presentation       | Each work shows an uncropped image, title, artist, and date. Images retain their proportions. Missing optional metadata uses a neutral fallback, without fabricated facts.                                                                                                        |
| F04 | Replace a work             | Replacing one work keeps the other two and the exhibition title unchanged. The replacement belongs to the active subject and is not already selected. While pending, that slot cannot issue duplicate requests. Failure preserves the existing work and offers retry.             |
| F05 | Reorder works              | Named move-left/move-right controls, adapted to the vertical mobile layout, change the selected order without changing IDs or title. Boundary moves are disabled. Controls work by keyboard; drag-and-drop is optional.                                                           |
| F06 | Edit title                 | A labeled input accepts a title of up to 80 characters. Whitespace-only input restores the subject's default title on commit. Text is rendered as text and survives refresh and sharing.                                                                                          |
| F07 | Inspect artwork            | Opening a work shows a larger uncropped image, title, artist, date, medium, and original museum record link. A description is optional and must be safe to render. Close and Escape return focus to the opener. A modal traps focus and prevents interaction with the background. |
| F08 | Share exhibition           | Copy link produces a URL containing the subject, three ordered artwork IDs, and committed title. A fresh session reconstructs the same exhibition without local storage. Clipboard failure exposes a selectable URL. Success is announced accessibly.                             |
| F09 | URL navigation             | Committed changes update URL state without a page reload. Browser back/forward restores the corresponding state. A new subject creates a history entry; title edits and individual curation changes replace the current entry to avoid excessive history.                         |
| F10 | Invalid shared state       | Unsupported subjects, malformed IDs, duplicate IDs, more or fewer than three IDs, and oversized titles are rejected. Show an explanatory recovery state with an action to load the default exhibition. Never silently present a different exhibition as the shared result.        |
| F11 | Unavailable shared work    | If a previously shared record is missing or no longer eligible, identify the unavailable slot and offer an explicit replacement or reset. Preserve any remaining valid works and title.                                                                                           |


## 5. API And Backend Requirements

Use the Art Institute of Chicago API for live metadata and its image delivery service for artwork images. Maintain small, manually reviewed ID pools to establish visual relevance. Reviewed IDs are editorial configuration, not a substitute for live API integration.

Use Next.js route handlers as a backend-for-frontend. UI components request normalized data from the application's routes. Image requests may go directly to the approved museum image host.


| ID  | Requirement         | Acceptance criteria                                                                                                                                                                                                                                       |
| --- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B01 | Validation          | Server routes accept only supported subjects and positive integer IDs from the reviewed subject pools. Bound list sizes, title length where accepted, and request parameters. Invalid requests return a consistent client error without an upstream call. |
| B02 | Eligibility         | Only records explicitly marked public domain with a usable image ID enter an exhibition. Missing or uncertain eligibility is excluded. A pool with fewer than three usable works produces a clear insufficient-content state.                             |
| B03 | Normalization       | Return only the fields the UI needs: ID, title, artist, date, medium, image information, rights status, and museum record URL. Optional fields may be absent without breaking rendering.                                                                  |
| B04 | Cache               | Cache successful normalized metadata for a proposed 1-hour TTL using a mechanism supported by the deployment runtime. Document the actual TTL, invalidation, and cache boundaries. Do not cache failures as successful data.                              |
| B05 | Upstream resilience | Apply a bounded timeout and at most two retries for transient network failures, 429, and 5xx responses. Use backoff, honor Retry-After within the total request deadline, and stop when that deadline is exhausted. Do not retry permanent 4xx responses. |
| B06 | Graceful failure    | Return consistent errors the UI can map to retry, empty, or unavailable states. An unsuccessful replacement never removes the visible work. Existing content remains usable during a recoverable refresh failure.                                         |
| B07 | Request control     | Prevent duplicate UI requests and limit accepted batch sizes. Document how upstream rate limiting is handled and any remaining abuse-protection limitations. Keep credentials server-side if introduced; never commit real secrets.                       |


The endpoint names in the brief are proposals. Final route contracts, timeout values, and cache implementation belong in the [implementation plan](IMPLEMENTATION_PLAN.md) and must be documented as implemented.

## 6. Design, Accessibility, And Performance

Use an unframed gallery or art-book composition with artworks as the main visual signal. Keep images uncropped, controls compact, typography deliberate, and color primarily in the art. The exhibition title may use an expressive serif; labels and controls use a readable sans-serif.


| ID  | Requirement           | Acceptance criteria                                                                                                                                                                                                                                                                             |
| --- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N01 | Responsive layout     | Verify at 375px, 768px, and 1440px widths. Mobile presents a vertical sequence and full-screen inspection. No horizontal page overflow, overlapping text, or inaccessible controls.                                                                                                             |
| N02 | Accessibility         | Use semantic markup, labeled inputs, named icon controls, visible focus, informative image alternatives, and accessible status messages. All required workflows work without a pointer.                                                                                                         |
| N03 | Signature motion      | Artwork inspection uses a shared-element or FLIP-style transition based mainly on transform and opacity. Reduced-motion preference removes or simplifies it. It remains optional to the user's ability to inspect art.                                                                          |
| N04 | Loading and stability | Show artwork-shaped skeletons for initial and subject loading; use static placeholders under reduced motion. Reserve image space, avoid shifting unaffected works during replacement, and size images for their rendered dimensions.                                                            |
| N05 | Performance evidence  | Aim for fluid 60fps interactions. Record a production Lighthouse mobile run with a proposed performance target of 85 or better and investigate material layout shift or scrolling jank. This number is a project target, not an assessment-defined threshold; disclose results and limitations. |


## 7. Required States


| Trigger                                            | Expected behavior                                                                     |
| -------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Initial or subject fetch                           | Stable gallery skeletons and an accessible loading status.                            |
| No eligible content                                | Clear empty state and a route to another subject or default exhibition.               |
| Upstream timeout, rate limit, or outage            | Recoverable error with retry; retain existing content where available.                |
| Replacement failure or exhausted pool              | Keep the current work; explain the issue beside its controls.                         |
| Image delivery failure                             | Preserve label and image space, show an image-unavailable fallback and a museum link. |
| Invalid or partially unavailable shared exhibition | Apply F10 or F11, with explicit recovery actions.                                     |
| Clipboard unavailable                              | Display the full selectable sharing URL.                                              |
| Rapid subject changes                              | Ignore or cancel stale responses so the last selected subject wins.                   |


## 8. Assessment Coverage


| Assessment requirement          | Planned evidence                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Third-party API                 | Live museum metadata, real images, API choice and quirks documented.                                                                                          |
| Creative, distinctive UI        | Gallery composition, typography, artwork inspection, mobile screenshots.                                                                                      |
| Smooth motion and performance   | Inspection transition, reduced-motion behavior, production performance results.                                                                               |
| Proper states                   | Explicit loading, empty, error, unavailable-image, and failed-request verification.                                                                           |
| Good practices                  | Clear client/server boundary, validation, accessibility, responsive behavior, no committed secrets.                                                           |
| At least one advanced feature   | Primary: backend with caching, rate-limit handling, retry/backoff, and graceful upstream failure. Secondary: signature animation if implemented and verified. |
| Shareable state                 | Required product capability. Do not claim the assessment's advanced URL-synced search option without its debounced, server-backed search and filters.         |
| Documentation and understanding | README and build log explain architecture, advanced feature, tradeoffs, testing, limitations, and tools used. Developer can explain submitted code.           |
| Time and scope discipline       | Log time per phase while working; stop at the time box, report actual completion and next steps honestly.                                                     |


The general assessment weights are product quality 25%, technical judgment 25%, creative problem solving 20%, communication 20%, and speed/resourcefulness 10%. Prioritize a working polished core and evidence of decisions accordingly.

## 9. Implementation And Deployment Milestones

Build order and per-phase test cases live in the [implementation plan](IMPLEMENTATION_PLAN.md). This table is the product-level gate only: do not start the next phase until the current exit criterion is true.

| Phase | Exit criterion |
| --- | --- |
| 1. Confirm scope and content | One default subject and at least six eligible works are verified. Open technical decisions in the implementation plan are recorded. BUILD_LOG.md is started. |
| 2. Build and deploy a vertical slice | One subject renders three live works through the backend, with responsive layout, loading, and recoverable error behavior. The live URL shows real metadata and images. |
| 3. Complete curation and sharing | Replace, reorder, title, inspect, and reconstruct a shared URL. Backend cache/retry behavior is verified. Preview deployment is updated. |
| 4. Polish and verify | Required states, keyboard/focus behavior, reduced motion, signature transition, and production performance checks are done. Extra subjects only if the core is complete. |
| 5. Release and document | Final candidate is deployed, live smoke checks pass, docs and submission links are complete. |

Deploy during phase 2, not only at the end. This exposes production image, cache, runtime, and route issues early enough to fix them. Redeploy meaningful milestones and verify the final production URL before submission.

Use project-specific instructions or skill files only when a repeated workflow needs them. They are optional tooling, not assessment deliverables. Introduce them when useful, keep them scoped, and log their use rather than building an extensive tooling system.

## 10. Verification Plan

Phase test cases, including what to automate vs. check in the browser, are in the [implementation plan](IMPLEMENTATION_PLAN.md). This section is the verification strategy, not the checklist.

Write focused automated checks for URL parsing/serialization, input bounds, eligibility filtering, duplicate prevention, and retry/cache behavior. Mock upstream failures for deterministic checks; also verify live museum integration separately.

Run a browser flow that opens the default exhibition, replaces and reorders works, edits the title, inspects and closes a work, copies a link, and opens it in a fresh session. Confirm IDs, order, subject, and title match after refresh and browser navigation.

Manually check malformed URLs, unavailable records, empty pools, upstream failure, image failure, clipboard failure, rapid subject changes, keyboard-only use, focus return, reduced motion, and all three viewport widths. Capture actual results and known gaps in the build log. Run production build, lint, and type checks where configured.

## 11. Deliverables And Release Gate

- Working live URL, verified in a fresh browser session.
- Public or reviewer-accessible repository for this project.
- Root README.md with features, local setup from zero, API choice/quirks, architecture and caching, advanced feature explanation, testing results, and limitations.
- Root BUILD_LOG.md, maintained during each phase, covering goal/scope, stack and AI tools, decisions and alternatives, hard parts, verification, limitations, and time spent.
- Root .env.example containing placeholders only, or an explicit statement that no environment variables are required.
- docs/PROJECT_BRIEF.md, this PRD, and docs/IMPLEMENTATION_PLAN.md.
- Optional but recommended video demonstrating the product and explaining one proud implementation detail and one challenge or shortcut.
- A shared final submission document collecting live, repo, and video links for all three separate projects.

Release only after the main journey works on the deployed site, the backend advanced feature has evidence, required states have been checked, and the documentation reflects the actual implementation. If the time box ends first, submit an honest account of completed scope, gaps, and next steps rather than claiming unchecked requirements passed. Confirm reviewer access and all links before the assessment's final submission, which locks further changes.

## 12. Decisions To Resolve Before Implementation

These are listed with the build sequence in the [implementation plan](IMPLEMENTATION_PLAN.md). Resolve them in phase 1:

- Which candidate subject passes the live content audit and becomes the default?
- Which verified artwork IDs form its launch pool?
- Which cache mechanism and request deadline fit the chosen deployment runtime?
- Which motion library or existing transition approach fits the stack and time budget?

Record decisions in the implementation plan and build log. Update this PRD if verified API behavior changes the scope or acceptance criteria.