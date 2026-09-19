# Content Audit

Source: [Art Institute of Chicago API](https://api.artic.edu/docs/)  
Dump: [api-data](https://github.com/art-institute-of-chicago/api-data) → `https://artic-api-data.s3.amazonaws.com/artic-api-data.tar.bz2`  
Status: **Not yet run** — fill this file during Phase 1 ingest.  
Date: _

## Method (planned)

1. Download the official AIC data dump (or a documented sample slice for the first pass). Prefer the dump over scraping `api.artic.edu` for bulk analysis.
2. Parse artwork records; keep fields needed for display and validation (`id`, title, artist, dates, medium, artwork type, `image_id`, dimensions, alt, `is_public_domain`, source URL, `subject_titles`, `term_titles`, optional description).
3. Qualify an artwork for a subject only when the canonical term or approved alias appears in `subject_titles` or `term_titles`. Title/description matches may rank but do not qualify alone.
4. Require `is_public_domain === true`, usable `image_id` + dimensions, and a dated record (`date_start` or derived year).
5. Validate a small IIIF request during ingest for displayable images.
6. Aggregate per term; assign journey-ready / browse-only / unavailable per [PROJECT_BRIEF.md](PROJECT_BRIEF.md) thresholds.
7. Manually review a deterministic sample of up to 12 works per launch subject (≥80% clearly related); store review result and reason.

## Dump / run metadata

| Field | Value |
| --- | --- |
| Dump URL / version | _ |
| Ingest run id | _ |
| Artworks upserted | _ |
| Terms evaluated | _ |
| Journey-ready count | _ |
| Browse-only count | _ |
| Unavailable / rejected notes | _ |

## Candidate journey-ready subjects

Fill after validation. Target ≥3 launch subjects discovered from data (examples only until proven: window, chair, bowl — **not** locked).

| Subject (canonical) | Qualifying works | Year span | Artists | Status | Notes |
| --- | --- | --- | --- | --- | --- |
| _ | _ | _ | _ | _ | _ |
| _ | _ | _ | _ | _ | _ |
| _ | _ | _ | _ | _ | _ |

## Relevance review (launch subjects)

| Subject | Sample size | Pass rate | Result | Notes |
| --- | --- | --- | --- | --- |
| _ | ≤12 | _ | _ | _ |

## AIC quirks to verify and document

- Prefer data dumps for bulk copy/analysis; avoid deep pagination / scraping of the live API (>10k search results).
- Live API: throttle to about one request per second when used; no API key required for public collection data.
- Images are not in the dump — construct IIIF URLs from `image_id`; museum does not offer an image dump.
- Schema of dump JSON mirrors the live API artwork resource; switching between dump and API should be straightforward.
- `is_public_domain` must be filtered locally from the dump for the public-domain set.
- Missing optional fields (description, some title arrays) are common; never invent metadata.
- Generic catalog terms (`art`, `painting`, `paper`, `people`, etc.) must be excluded or down-weighted for Connections.

## Out of scope for this audit

- The Met Collection API and any `data/subjects.json` Met object-ID pools from the previous exhibition-maker direction.
- Multi-museum fusion.
