# Build Log: Museum Exhibition Maker

Assignment: Creative, API-Integrated Web App
Related documents: [Project brief](docs/PROJECT_BRIEF.md), [PRD](docs/prd.md), [Implementation plan](docs/IMPLEMENTATION_PLAN.md)

Working log at the repo root. Update after every meaningful change, not only at phase end. Do not claim unchecked work passed.

## Goal & scope decision

Building a small exhibition maker: a visitor opens a complete three-work show of everyday subjects in art, inspects works, replaces and reorders them, names the show, and shares a URL that reconstructs it.

Using the Art Institute of Chicago API for live metadata and images, with a manually reviewed ID pool for visual relevance. Primary advanced feature is a Next.js backend-for-frontend with validation, cache, retry/backoff, and graceful upstream failure. Shareable URL state is a required product capability, not the assessment's optional search feature.

Left out to keep the product small: accounts, database, private collections, multiple museums, catalog search, essays, annotation, zoom, drag-and-drop, editorial prompts, and downloadable exhibition images. Launch with one verified subject; add more only after the core journey works.

## Stack & tooling

Chosen, not yet scaffolded:

- Next.js App Router and route handlers as the BFF. UI calls app routes, not the museum API.
- Art Institute of Chicago API plus its image host.
- Cursor as the implementation assistant. Other libraries (motion, test runner, deploy target) TBD in phase 1.

## Key decisions & trade-offs

- Decision: reviewed artwork ID pools plus live metadata, because keyword search often matches catalog text without showing the subject. Alternative considered: live search-only; rejected for visual relevance.
- Decision: BFF route handlers as the advanced feature, because the assessment needs a real client/server boundary, validation, cache, and upstream resilience. Alternative considered: client-only museum calls; rejected.
- Decision: shareable URL as source of truth, no required local storage or accounts. Alternative considered: save exhibitions server-side; out of scope.
- Open: default subject, launch IDs, cache mechanism, timeout/retry budget, inspection motion. See implementation plan.

## Hard parts / dead ends

None yet. Implementation has not started.

## How I verified it works

Phase test cases live in the implementation plan. Record pass/fail and gaps here.

| Phase | Status | Result |
| --- | --- | --- |
| 1. Confirm scope and content | In progress | Brief, PRD, and implementation plan drafted. Build log moved to repo root. Live content audit and open technical decisions not done. |
| 2. Vertical slice and first deploy | Not started | |
| 3. Curation, inspection, and sharing | Not started | |
| 4. Polish and verify | Not started | |
| 5. Release and document | Not started | |

## Known limitations

None from implementation yet. Scope limits are in the PRD.

## Time spent

| Phase | Time | Notes |
| --- | --- | --- |
| 1. Confirm scope and content | | Docs started; build log moved to root; content audit remaining. |
| 2. Vertical slice and first deploy | | |
| 3. Curation, inspection, and sharing | | |
| 4. Polish and verify | | |
| 5. Release and document | | |
| Total | | |

## Session notes

### 2026-09-18

- Moved the build log from `docs/BUILD_LOG.md` to the repo root so it matches the assessment deliverable.
- Linked related docs from the new path (`docs/PROJECT_BRIEF.md`, `docs/prd.md`, `docs/IMPLEMENTATION_PLAN.md`).
- Added a project rule to update this file after every meaningful change, not only at phase end.
- Phase 1 still open: live content audit, default subject, launch IDs, cache, timeout/retry, and motion approach.
