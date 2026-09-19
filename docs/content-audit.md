# Content Audit: The Met (Subject Museum)

Source: [Met Collection API](https://metmuseum.github.io/) + [Open Access dataset](https://github.com/metmuseum/openaccess).

## Eligibility

- `Is Public Domain` / `isPublicDomain` = true
- Non-empty `primaryImage` or `primaryImageSmall`
- Usable `Object Begin Date` / `objectBeginDate`
- At least one subject **tag** after normalization (blocklist generics)

## Launch Tag Targets

| Slug | Notes |
| --- | --- |
| flower | Met tags / search |
| landscape | Met tags / search |
| animal | Met tags / search |

## Sample Load

Document counts after ingest in BUILD_LOG: artworks upserted, journey_ready terms, connection/period rows.

## Manual Relevance

Spot-check ≤12 images per launch subject for visual relevance of the tag (≥80% goal).
