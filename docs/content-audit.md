# Content Audit (Phase 1)

Source: [The Met Collection API](https://metmuseum.github.io/)
Date: 2026-09-18

## Method

1. Search via `GET /public/collection/v1.1/search?q={term}&hasImages=true&limit=…` (and `tags=true` for some passes).
2. Fetch each candidate with `GET /public/collection/v1/objects/{id}`.
3. Keep only `isPublicDomain === true` with a non-empty `primaryImage`.
4. Open `primaryImageSmall` and confirm the image actually shows the subject.

## Candidate summary

| Subject | Eligible sample (PD + image) | Notes |
| --- | --- | --- |
| windows | 19+ after “stained glass” / “window” searches | Strongest everyday-subject fit; chosen as default |
| chairs | 14+ (armchairs / side chairs) | Strong runner-up for Phase 4 |
| bowls | 14 from first tag search | Strong runner-up for Phase 4 |
| hands | ~4–7 in sample | Needs a wider ID hunt before publish |

Tag-only searches for “windows” returned many Tiffany design drawings that were not public domain and had no `primaryImage`. Architectural / stained-glass queries were required.

## Locked launch subjects

### windows

Config: [`data/subjects.json`](../data/subjects.json)

| Role | Object IDs |
| --- | --- |
| Default exhibition | 9817, 14808, 453573 |
| Full launch pool (9) | 9817, 14808, 453573, 5497, 14807, 5496, 444829, 444826, 436896 |

Each ID was live-fetched and visually reviewed. Rejected examples include non-PD Tiffany designs (e.g. 16967), casement listings with misleading images (1457), and figure-centered glass fragments (467916).

### chairs (Phase 3)

| Role | Object IDs |
| --- | --- |
| Default exhibition | 221, 230, 269 |
| Full pool (9) | 221, 230, 269, 252, 219, 233, 177, 182, 212 |

Live-fetched as public domain with `primaryImage`; object names are armchairs / side chair.

## Met quirks noted

- No API key; no env vars.
- Search returns IDs only; object fetch is required for eligibility and images.
- `hasImages=true` does not imply open-access JPEG availability.
- Missing optional fields often arrive as empty strings.
- Object endpoint can be slow (~15–25s cold); BFF timeout/retry must account for this.
- Prefer `/v1.1/search`; `/v1/search` retires 1 Oct 2026.
