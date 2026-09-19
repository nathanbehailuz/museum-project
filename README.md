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

## Met ingest

```bash
npm run ingest:download   # MetObjects.csv → data/met/ (optional bulk)
npm run ingest            # load PD+image+tag slice into Supabase (API and/or CSV)
npm run ingest:connections  # term_connections + term_periods
```

No museum API key. Images are hotlinked Met JPEGs (`images.metmuseum.org`).

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
| `SUPABASE_SERVICE_ROLE_KEY` | Ingest only |

See `BUILD_LOG.md` for verification.
