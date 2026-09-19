# Content Audit

Source: [Art Institute of Chicago API](https://api.artic.edu/docs/)  
Getting-started: [api-data/getting-started](https://github.com/art-institute-of-chicago/api-data/tree/master/getting-started)  
Enrichment: live `GET https://api.artic.edu/api/v1/artworks?ids=…&fields=…`  
Supabase project: `soavlmfrtmobmgesccrp` (`https://soavlmfrtmobmgesccrp.supabase.co`)  
Status: **Phase 1 sample ingest complete** (getting-started + live enrich)  
Date: 2026-09-19

## Method (executed)

1. Downloaded official getting-started files into `data/aic/` (gitignored binaries):
   - `allArtworks.jsonl` (~21 MB; id, title, artist, department, accession only)
   - `someArtworks.csv` (~422 highlighted works; same sparse fields)
2. Built ID universe: all `someArtworks` IDs + 800 additional IDs from `allArtworks.jsonl` (1222 total).
3. Enriched each ID from the live AIC API with `subject_titles`, `term_titles`, dates, `image_id`, thumbnail, `is_public_domain`.
4. Normalized + upserted into Supabase (`artworks`, `terms`, `artwork_terms`); recorded `ingestion_runs`.
5. Validated terms per [PROJECT_BRIEF.md](PROJECT_BRIEF.md) thresholds; stored `validation_reasons`.
6. Re-ran load against the same cache: artwork count stayed **1222** (idempotent upsert on `(source, source_id)`).

**Why live enrich?** Getting-started files alone cannot support journey validation — they lack catalog subjects, rights, images, and dates.

## Dump / run metadata

| Field | Value |
| --- | --- |
| Source version | `getting-started+live-enrich` |
| ID universe | 422 someArtworks + 800 jsonl = 1222 |
| Artworks upserted | 1222 |
| Displayable (PD + image + dated) | ~861 in enrich cache |
| Terms evaluated | ~1606 |
| Journey-ready (examples below) | many; see preferred launch set |
| Browse-only / unavailable | stored with reasons on `terms.validation_reasons` |

## Candidate journey-ready subjects (for manual relevance review)

Preferred everyday / visual subjects discovered from this slice (all hard requirements passed in automation):

| Subject (canonical) | Qualifying works | Year span | Artists | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| flower | 84 | 1505 | 28 | journey_ready | Strong launch candidate |
| landscape | 72 | 1431 | 44 | journey_ready | Strong launch candidate |
| animal | 71 | 2981 | 45 | journey_ready | Strong launch candidate |
| vessel | 59 | 5187 | 23 | journey_ready | Object / design angle |
| portrait | 58 | 1776 | 51 | journey_ready | Broad; still catalog-valid |
| tree | 48 | 2331 | 35 | journey_ready | |
| water | 31 | 262 | 28 | journey_ready | |
| bird | 28 | 2531 | 19 | journey_ready | |
| horse | 24 | 2239 | 21 | journey_ready | |

Launch review target for UI: **flower**, **landscape**, **animal** (or vessel/tree as alternates). Manual ≥80% relevance sample still pending (Phase 1 exit P1-5 partial — candidates listed; visual review not finished).

## Relevance review (launch subjects)

| Subject | Sample size | Pass rate | Result | Notes |
| --- | --- | --- | --- | --- |
| flower | ≤12 | _ | pending | |
| landscape | ≤12 | _ | pending | |
| animal | ≤12 | _ | pending | |

## AIC quirks verified

- Getting-started JSONL/CSV are sparse; full validation fields require dump files or live API enrich.
- Live API accepts batched `ids=` (we used 40/request, ~1.1s pause).
- `is_public_domain` must be filtered client-side; many highlighted works are not PD.
- Images are IIIF via `image_id`; not in getting-started files.
- Generic / technique / fair tags (`painting`, `oil on canvas`, `century of progress`, etc.) are blocked or down-ranked in normalize.
- Singularization must not turn `canvas` into `canva`.

## Out of scope for this audit

- Full S3 dump ingest (`artic-api-data.tar.bz2`) — next expansion once getting-started path is solid.
- Multi-museum fusion.
