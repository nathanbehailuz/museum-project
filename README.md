# Subject Museum

Searchable digital museum of everyday things in art — **Art Institute of Chicago** catalog indexed in Supabase. Pitch: *Type a thing. See how artists have pictured it across time.*

Product docs: `docs/PROJECT_BRIEF.md`, `docs/prd.md`, `docs/IMPLEMENTATION_PLAN.md`.

**Note:** The deployed Vercel app is still the previous Met three-work exhibition maker until Phase 3 UI ships. Phase 1 index is live in Supabase.

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

## Phase 1 ingest (AIC getting-started)

```bash
npm run ingest:download          # allArtworks.jsonl + someArtworks.csv → data/aic/
INGEST_ENRICH_ONLY=1 npm run ingest   # enrich IDs via api.artic.edu → enriched-cache.json
# Requires SUPABASE_SERVICE_ROLE_KEY:
npm run ingest:load-cache        # upsert artworks/terms + validate statuses
```

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
- Art Institute of Chicago API + IIIF images
- Vitest

See `BUILD_LOG.md` for decisions and verification.
