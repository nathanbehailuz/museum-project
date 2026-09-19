# PRD: The Met Archive

Status: Draft for implementation (Met pivot)
Assignment: Creative, API-Integrated Web App
Related documents: [Project brief](PROJECT_BRIEF.md), [Implementation plan](IMPLEMENTATION_PLAN.md), [Content audit](content-audit.md)

Launch museum: **The Metropolitan Museum of Art** only. Subjects come from Met **tags** validated into Supabase. Images: Open Access JPEGs via `primaryImage` / `primaryImageSmall` ([API docs](https://metmuseum.github.io/)).

## 1. Product Goal

Help a curious visitor notice everyday subjects in art by searching a validated subject index, following a chronological Journey, inspecting works, exploring catalog co-occurrences, and sharing the current view.

Pitch: **What do you want to find in art?**

## 2. Scope

Release requirements: search → Journey → inspect → Connections → share. Launch with ≥3 journey-ready subjects from Met tags after validation.

Out of scope: accounts, multiple museums, computer vision, IIIF, storing image files in Supabase Storage, All Works browse page.

## 3. Main User Journey

1. Open search; see suggestions and a featured subject.
2. Open a journey-ready subject → Journey constellation.
3. Inspect a work (`?artwork=`).
4. Explore Connections; share URL.

## 4. Functional Requirements (summary)

- F01–F02: Search autocomplete from validated terms.
- F03: Journey / browse-only / unavailable messaging.
- F05–F06: Journey and Connections on indexed data.
- F08–F10: Inspection + shareable URL state.
- Images must render from Met JPEG URLs (not AIC IIIF).

## 5. Data

- Bulk: Met Open Access `MetObjects.csv` (filtered PD + image + tags).
- Live: `collectionapi.metmuseum.org` `/v1.1/search` + `/v1/objects/{id}`.
- Index: Supabase `artworks`, `terms`, `artwork_terms`, `term_connections`, `term_periods`, `ingestion_runs`.
- Subjects are **catalog tags** (motif / depiction), not computer vision.
