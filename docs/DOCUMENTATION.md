# Documentation — The Met Archive

Assignment documentation for the Creative, API-Integrated Web App. Product overview and run instructions live in [README.md](../README.md); process notes in [BUILD_LOG.md](../BUILD_LOG.md).

## 01 — API choice

**Primary APIs / data sources**

1. **[The Met Collection API](https://metmuseum.github.io/)** — object metadata (`/public/collection/v1/objects/{id}`), no API key.
2. **Met Open Access CSV (`MetObjects.csv`)** — large public-domain object list with subject tags used as a dump index (no image URLs in the CSV).
3. **Met image CDN** — `images.metmuseum.org` JPEGs hotlinked at runtime (not stored in our backend).

**Why Met**

I wanted a museum product, not a generic CRUD demo. I’ve always loved museums and I’ve been to The Met once — that visit stuck with me, so wiring the Open Access catalog into a searchable “archive of everyday things in art” felt like the right creative bet.

Practically:

- No key and generous Open Access terms for educational use
- Direct JPEG URLs (unlike AIC IIIF, which we hit Cloudflare blocks on during an earlier spike)
- The CSV gives subject depth at catalog scale; the live API fills in images and dates when we enrich

**Quirks we designed around**

- CSV has tags/dates but **no image URLs** — enrich must call the object endpoint
- Bulk fetch can get **Incapsula 403s** and timeouts — we prefer on-demand small caps + checkpoints over a forced full crawl at launch
- Object endpoint latency varies — short timeouts, DB-first reads, graceful skip when enrich isn’t configured

## 02 — Architecture

```
Browser (RSC + client UI)
  → Next.js route handlers `/api/*` and server components   ← client / server line
  → Supabase Postgres (anon read; service role write/enrich)
  → Met Collection API (server-only) + Met JPEG CDN (browser <img>)
```

**Client / server line**

- **Client** renders search, journey constellation, connections graph, inspection modal. It calls our own `/api/*` routes and receives already-shaped JSON. It never sees `SUPABASE_SERVICE_ROLE_KEY`.
- **Server** (App Router RSC + BFF) talks to Supabase, runs `ensureSubjectEnriched` when a subject opens, and maps DB rows into UI types (`ArtworkCard`, journey feed, connection edges).

**Where caching lives**

| Layer | What |
| --- | --- |
| **Supabase `object_tags`** | Dump-derived subject → Met `source_id` index (~catalog depth). Powers search and “how deep is this subject?” |
| **Supabase `artworks` + `artwork_terms`** | Cached Met objects (title, dates, image URLs, links). Journey and inspection read from here. |
| **Supabase `term_periods` / `term_connections`** | Precomputed chapter buckets and co-occurrence edges. |
| **On-demand enrich** | If a subject is thin in cache and service role is set, server fetches a small missing-ID cap from Met and upserts. Repeat visits are DB-only. |
| **Browser** | No durable exhibition store; **URL** (`/subject/[slug]/journey?chapter=&artwork=`) is the shareable state. |

Images are not mirrored into Storage — we hotlink Met JPEGs and fall back UI-side when an image fails.

## 03 — Advanced feature

**Backend-for-frontend + indexed cache (+ shareable URL state)**

1. **BFF** — Routes like `/api/subjects`, `/api/subjects/[slug]/journey/works`, `/api/artworks/[sourceId]`, `/api/subjects/[slug]/connections` validate input, hide Supabase/Met shapes, and return stable cards for the UI.
2. **Indexed cache** — The dump tag index makes autocomplete and journey-ready status possible without calling Met on every keystroke. Cached artwork rows make Journey chronological without waiting on the full catalog.
3. **Server-side enrich** — `ensureSubjectEnriched` uses the service role only on the server: pick uncached IDs → Met object fetch → upsert → recompute periods. If the key is missing, enrich no-ops and the app still serves whatever is already in the DB.
4. **Shareable URLs** — `subjectUrlState` encodes view, chapter, and artwork so Share / reload reconstructs the same place in the archive.

Together, the visitor gets a museum experience from our index, while Met stays an upstream dependency the browser never holds credentials for.

## 04 — How I tested this

**Automated**

```bash
npm test          # Vitest: normalize/validate, URL parse, Met retry/backoff, connection helpers
npm run lint
npx tsc --noEmit
npm run build
```

**Manual / smoke**

- Home: search debounce, suggestions, collection map hover/click → journey
- Journey: chronological order, epoch filter, horizontal scroll, inspect `?artwork=`, brand link → `/`
- Connections: related subjects, shared-work strip, open journey
- Failure paths: missing env → index error copy; search retry; inspection retry; image fallback
- Local + production alias: https://museum-exhibition-iota.vercel.app (e.g. `/subject/flower/journey`)

**Edge cases noted**

- Subject with high `catalog_work_count` but few cached rows → Journey shows cached set only until enrich/bulk jobs catch up
- Enrich without service role → no crash; DB-only
- Bulk subject ingest (Coat Of Arm) — 403/timeouts; resume from checkpoint rather than claiming a full catalog load

**Would add with more time**

Playwright path suite, Lighthouse on mid-range mobile, and a finished bulk-cache pass for a few demo subjects.
