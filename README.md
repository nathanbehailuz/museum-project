# Subject Museum (The Met)

Searchable digital museum of everyday things in art — **The Metropolitan Museum of Art** catalog indexed in Supabase. Pitch: *Type a thing. See how artists have pictured it across time.*

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

No museum API key. Images are hotlinked Met JPEGs (`images.metmuseum.org`). Ingest/refresh need `SUPABASE_SERVICE_ROLE_KEY`.

```bash
npm run ingest:download   # optional: MetObjects.csv → data/met/
npm run ingest            # search + load PD+image+tag slice into Supabase
npm run ingest:refresh    # soft refresh: re-fetch existing Met object IDs
npm run ingest:connections  # term_connections + term_periods
```

### Soft refresh (default)

Re-fetches live `/v1/objects/{id}` for rows already in the index (metadata + `image_url` / `image_url_small`). Does not rebuild terms.

```bash
npm run ingest:refresh
npm run ingest:connections
```

### Expand the slice

```bash
MET_INGEST_QUERIES=flower,landscape,animal MET_INGEST_LIMIT=80 npm run ingest
npm run ingest:connections
```

### Clean reload

Destructive. In the Supabase SQL Editor, run the `TRUNCATE` from `supabase/migrations/20260919140000_met_pivot.sql`, then:

```bash
npm run ingest
npm run ingest:connections
```

## App routes

| Path | Purpose |
| --- | --- |
| `/` | Search + teaser |
| `/subject/[slug]/journey` | Chronological chapters |
| `/subject/[slug]/works` | Filtered grid |
| `/subject/[slug]/connections` | Co-occurrence |
| `?artwork=` | Inspection |

## Environment

| Variable | Where |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server |
| `SUPABASE_SERVICE_ROLE_KEY` | Ingest / refresh only |

See `BUILD_LOG.md` for verification.
