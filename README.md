# Subject Museum

Searchable digital museum of everyday things in art — **Art Institute of Chicago** catalog indexed in Supabase. Pitch: *Type a thing. See how artists have pictured it across time.*

Product docs: `docs/PROJECT_BRIEF.md`, `docs/prd.md`, `docs/IMPLEMENTATION_PLAN.md`.

**Phase 3 live:** https://museum-exhibition-iota.vercel.app  
Launch subjects: `/subject/flower/journey`, `/subject/landscape/journey`, `/subject/animal/journey`.

## Local setup

```bash
npm install
cp .env.example .env.local
# Fill NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

```bash
npm test
npm run build
```

Open `/` to search subjects. Example journeys: `/subject/flower/journey`, `/subject/landscape/journey`, `/subject/animal/journey`.

## App routes

| Path | Purpose |
| --- | --- |
| `/` | Search home + flower teaser |
| `/subject/[slug]/journey` | Chronological chapters |
| `/subject/[slug]/works` | Filtered grid (URL filters) |
| `/subject/[slug]/connections` | Ranked co-occurrence + radial |
| `?artwork=` | Shared inspection on any subject view |

## API (BFF → Supabase)

- `GET /api/subjects?q=`
- `GET /api/subjects/[slug]`
- `GET /api/subjects/[slug]/journey|works|connections`
- `GET /api/artworks/[sourceId]`

## Phase 1–2 ingest (AIC getting-started)

```bash
npm run ingest:download          # allArtworks.jsonl + someArtworks.csv → data/aic/
INGEST_ENRICH_ONLY=1 npm run ingest   # enrich IDs via api.artic.edu → enriched-cache.json
# Requires SUPABASE_SERVICE_ROLE_KEY:
npm run ingest:load-cache        # upsert artworks/terms + validate statuses
npm run ingest:connections       # term_connections + term_periods
npm run ingest:images            # mirror IIIF 843px JPEGs → Supabase Storage `iiif/`
```

Images are **not** hotlinked from artic.edu at runtime (Cloudflare often blocks embeds). They are mirrored once via GitHub Actions into public Storage and served from there.

### Mirror images (GitHub Actions)

1. Add repository secrets: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
2. Actions → **Mirror AIC IIIF images** → Run workflow
3. The job scrapes AIC IIIF one-at-a-time (~1s delay, `/full/843,/0/default.jpg`) and uploads `iiif/{image_id}/843.jpg`

Getting-started files are sparse (no subjects/images/PD). The pipeline uses them as an ID universe, then enriches from the live API. See `data/aic/README.md` and `docs/content-audit.md`.

## Environment variables

| Variable | Where |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server (RLS read) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server / ingest only — never commit |

## Stack

- Next.js App Router + TypeScript
- Supabase Postgres (subject index)
- Art Institute of Chicago API + mirrored IIIF images (Supabase Storage)
- Vitest

See `BUILD_LOG.md` for decisions and verification.
