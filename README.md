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

No museum API key. Images are hotlinked Met JPEGs (`images.metmuseum.org`). Ingest needs `SUPABASE_SERVICE_ROLE_KEY`.

### Full Open Access catalog (recommended)

CSV has metadata only — JPEG URLs come from the Collection API. Expect a multi-hour first run; resume is automatic.

```bash
npm run ingest:download      # ~318MB MetObjects.csv → data/met/
npm run ingest:csv-filter    # PD + tags + begin date → eligible-ids.json
MET_CSV_FRESH=1 npm run ingest:csv   # truncate + enrich + upsert + rebuild terms
# Resume after interrupt / Incapsula backoff: npm run ingest:csv
npm run ingest:rebuild-terms         # optional mid-load terms rebuild
npm run ingest:connections
```

Resume after interrupt: `npm run ingest:csv` (reads `csv-load-checkpoint.json`).  
Smoke subset: `MET_CSV_MAX=500 MET_CSV_FRESH=1 npm run ingest:csv`.  
Expect multi-hour runtime (~140k eligible IDs); Met may return temporary 403s — the loader backs off and retries.

### API search slice (smaller)

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
