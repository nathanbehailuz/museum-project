# The Met Archive

Searchable digital museum of everyday things in art — **The Metropolitan Museum of Art** catalog indexed in Supabase. Pitch: *What do you want to find in art?*

API docs: https://metmuseum.github.io/  
Product docs: `docs/PROJECT_BRIEF.md`, `docs/prd.md`, `docs/IMPLEMENTATION_PLAN.md`.

**Live:** https://museum-exhibition-iota.vercel.app  
Example: `/subject/flower/journey`

## Features

- **Subject search** — debounced autocomplete over dump-deep catalog tags
- **Chronological Journey** — constellation of cached, dated works with epoch chips and horizontal scroll
- **Connections** — co-occurrence graph of related subjects (shared catalog tags)
- **Artwork inspection** — `?artwork=` modal with focus trap and Met source link
- **Shareable URLs** — subject, view, chapter, and artwork encoded in the path/query
- **On-demand Met enrich** — first visit caches a small batch of missing objects server-side

## Architecture

```
Browser → Next.js App Router (RSC + client UI)
       → Route handlers `/api/*` (BFF)
       → Supabase (terms, artworks, artwork_terms, object_tags, term_periods, term_connections)
       → Met Collection API (server-only enrich) + Met JPEG CDN (hotlinked images)
```

- **Client** never holds `SUPABASE_SERVICE_ROLE_KEY`. Browser uses anon/publishable keys for reads.
- **BFF** validates slugs, serves journey/works/connections/artworks, and hides upstream shape.
- **Caching** lives in Supabase: dump tag index (`object_tags`) + cached Met object rows. Opening a subject can fetch a small missing-object cap when the service role is configured.
- **Journey UI** reads all *cached* displayable works for a subject (chronological), not the full dump catalog until those IDs are enriched.

## API choice

**The Met Collection API** (no API key) plus the Open Access `MetObjects.csv` dump.

- Direct JPEG URLs (`images.metmuseum.org`) avoid IIIF/CDN blocks seen with other museum sources
- CSV gives a large subject tag index without storing image binaries
- Quirks: Incapsula 403s on bulk crawls; CSV has no image URLs; object endpoint can be slow — enrich uses short timeouts, small caps, and DB-first reads

## Advanced feature

**Backend-for-frontend + indexed cache:** Next.js route handlers and server components talk to Supabase; optional `SUPABASE_SERVICE_ROLE_KEY` enriches missing Met objects on the server with graceful skip when the key is absent. Shareable URL state (`subjectUrlState`) keeps journey chapter and inspection in the address bar.

## Local setup

```bash
npm install
cp .env.example .env.local
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

## Met ingest & refresh

No museum API key. Images are hotlinked Met JPEGs. Server enrich needs `SUPABASE_SERVICE_ROLE_KEY` (never `NEXT_PUBLIC_`).

### On-demand cache (default)

```bash
npm run ingest:download      # MetObjects.csv → data/met/
npm run ingest:csv-filter    # PD + tags + begin date → eligible-ids.json
npm run ingest:tags          # object_tags + catalog_work_count (no Met API)
```

Production also needs `SUPABASE_SERVICE_ROLE_KEY` on Vercel so first visits can cache. Repeat visits are DB-only.

Optional full pre-cache (slow, Incapsula risk): `npm run ingest:csv` / `ingest:csv:all`. Not required for demos.

### Soft refresh

```bash
npm run ingest:refresh
npm run ingest:connections
```

## App routes

| Path | Purpose |
| --- | --- |
| `/` | Search + collection map + featured subject |
| `/subject/[slug]/journey` | Chronological constellation |
| `/subject/[slug]/connections` | Catalog co-occurrence graph |
| `/subject/[slug]/works` | Redirects to journey |
| `?artwork=` / `?chapter=` | Inspection / epoch filter |

## Environment

| Variable | Where |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server |
| `SUPABASE_SERVICE_ROLE_KEY` | Server enrich / ingest only |

## Testing & verification

```bash
npm test          # Vitest (normalize, URL state, Met retry, etc.)
npm run lint
npm run build
```

Manual smoke: home search → Flower journey → epoch chip → artwork inspect → Connections. See `BUILD_LOG.md` for phase tables and known limitations.
