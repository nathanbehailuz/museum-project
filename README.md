# The Met Archive

Searchable digital museum of everyday things in art — **The Metropolitan Museum of Art** catalog indexed in Supabase. Pitch: *What do you want to find in art?*

API docs: https://metmuseum.github.io/  
Product docs: `docs/PROJECT_BRIEF.md`, `docs/prd.md`, `docs/IMPLEMENTATION_PLAN.md`.

**Live:** https://museum-exhibition-iota.vercel.app  
Example: `/subject/flower/journey`

## Local setup

```bash
npm install
cp .env.example .env.local
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

## Met ingest & refresh

No museum API key. Images are hotlinked Met JPEGs (`images.metmuseum.org`). Server enrich needs `SUPABASE_SERVICE_ROLE_KEY` (never `NEXT_PUBLIC_`).

### On-demand cache (default)

The CSV dump is an **ID + tags index** (no JPEG URLs). Search uses that index. Opening a subject loads whatever is already in Supabase, fetches a small cap of missing objects from the Collection API, and caches them.

```bash
npm run ingest:download      # ~318MB MetObjects.csv → data/met/
npm run ingest:csv-filter    # PD + tags + begin date → eligible-ids.json
npm run ingest:tags          # load object_tags + catalog_work_count (no Met API)
```

Production also needs `SUPABASE_SERVICE_ROLE_KEY` set on Vercel so first visits can cache. Repeat visits are DB-only.

Optional full pre-cache (slow, ~30h, Incapsula 403s): `npm run ingest:csv` / `ingest:csv:all`. Not required for the product.

### API search slice (smaller prefetch)

```bash
npm run ingest
npm run ingest:connections
```

### Soft refresh (existing rows only)

```bash
npm run ingest:refresh
npm run ingest:connections
```

## App routes

| Path | Purpose |
| --- | --- |
| `/` | Search + featured subject |
| `/subject/[slug]/journey` | Chronological constellation |
| `/subject/[slug]/connections` | Catalog co-occurrence graph |
| `/subject/[slug]/works` | Redirects to journey |
| `?artwork=` | Inspection |

## Environment

| Variable | Where |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server |
| `SUPABASE_SERVICE_ROLE_KEY` | Ingest / refresh only |

See `BUILD_LOG.md` for verification.
