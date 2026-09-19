# Implementation Plan: Subject Museum

Status: Phase 4 complete — Met index refresh documented + scripted
Related documents: [Project brief](PROJECT_BRIEF.md), [PRD](prd.md), [Content audit](content-audit.md)

Launch source: **The Met** ([docs](https://metmuseum.github.io/)). Images via `images.metmuseum.org` JPEGs. Index in Supabase. Do not use Art Institute of Chicago for v1.

## Locked Decisions

| Decision | Choice |
| --- | --- |
| Museum | [The Met Collection API](https://metmuseum.github.io/) |
| Bulk data | [Open Access CSV](https://github.com/metmuseum/openaccess) `MetObjects.csv` (stream/filter; assessment may use a tagged PD slice) |
| Live API | `https://collectionapi.metmuseum.org` — `/public/collection/v1.1/search`, `/public/collection/v1/objects/{id}` — no API key |
| Images | Hotlink `primaryImageSmall` / `primaryImage` (JPEG). No IIIF; no Storage image mirror |
| Eligibility | `isPublicDomain`, non-empty image URL, usable `objectBeginDate`, ≥1 non-generic tag |
| Subjects | Normalized Met **tags** → `terms`; evidence `tag` |
| Index | Supabase: `artworks`, `terms`, `artwork_terms`, `term_connections`, `ingestion_runs`, `term_periods` |
| Launch subjects | ≥3 journey-ready tags after validation (flower, landscape, animal targets) |
| App routes | `/subject/{slug}/journey\|works\|connections` |
| Deploy | Vercel + Supabase env vars |
| Connections | `shared / sqrt(n_A * n_B)`; min 3 shared; exclude generics |
| Motion | CSS transform/opacity; `prefers-reduced-motion` |

## Route Contracts

| Route | Purpose |
| --- | --- |
| `GET /api/subjects?q=` | Autocomplete validated terms |
| `GET /api/subjects/{slug}/journey\|works\|connections` | Subject views |
| `GET /api/artworks/{sourceId}` | Inspection detail |

UI loads images directly from Met JPEG URLs returned in artwork payloads.

## Phases

1. **Supabase + Met ingest** — schema for `image_url` / `image_url_small`; CSV or API slice load; validation. **Done.**
2. **Connections + periods** — same scoring/period logic on Met tags. **Done.**
3. **UI** — existing Subject Museum pages; Met images. **Done.**
4. **Refresh** — documented re-ingest / live object refresh. **Done.**

### Phase 4 operator runbook

| Path | Commands |
| --- | --- |
| Soft refresh | `npm run ingest:refresh` → `npm run ingest:connections` |
| Expand slice | `MET_INGEST_QUERIES=… MET_INGEST_LIMIT=… npm run ingest` → connections |
| Clean reload | Run `TRUNCATE` from `supabase/migrations/20260919140000_met_pivot.sql` in SQL Editor → `npm run ingest` → connections |

Requires `SUPABASE_SERVICE_ROLE_KEY`. No Met API key. Soft refresh upserts artwork metadata + JPEG URL columns; it does not rebuild terms.

## Previous Direction

AIC dump + IIIF and the Met three-work exhibition maker are superseded for the primary product. Legacy Met gallery files may remain unused in `src/`.
