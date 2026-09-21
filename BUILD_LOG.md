# Build Log: Creative, API-Integrated Web App — The Met Archive

Live: https://museum-exhibition-iota.vercel.app  
Repo README: [README.md](README.md) · Assignment docs: [docs/DOCUMENTATION.md](docs/DOCUMENTATION.md)

## Goal & scope decision

Built a **searchable subject museum**: type a motif (flower, landscape, …), walk a chronological Journey, explore Connections (catalog co-occurrence), inspect a work, share the URL.

Chose **The Met Open Access** (CSV tag index + Collection API) over a three-work “exhibition maker” and over AIC IIIF — better story for the brief, no API key, direct JPEGs.

**Left out** to fit time: accounts, multi-museum, full 139k-object overnight crawl as a launch gate, All Works as a third primary page (redirects to Journey), OpenSeadragon, manual image-relevance audit for every subject.

## Stack & tooling

- **Next.js 15** App Router + TypeScript — RSC UI + `/api/*` BFF
- **Supabase** — indexed artworks/terms/tags/periods/connections; service role only for server enrich/ingest
- **Met Collection API** + `MetObjects.csv` — metadata + hotlinked JPEGs
- **React Flow** — homepage collection map + connections graph
- **Vitest** — normalize/validate/URL state/Met retry
- **Vercel** — production deploy
- **Cursor** — implementation assistant

## Key decisions & trade-offs

- **Met over AIC IIIF** because Cloudflare blocked artic.edu image fetch/hotlink; Met JPEGs work with CORS. Alternative: Storage mirror of IIIF — deferred.
- **Supabase index + BFF** as the advanced feature (not client-only Met calls) so secrets, validation, and enrich stay server-side. Alternative: browser → Met directly — rejected.
- **Dump tags (`object_tags`) + on-demand enrich** instead of finishing the full CSV crawl. Search/depth from dump; journey images from cached objects (small fetch cap per visit). Alternative: 30h+ Incapsula-prone crawl — parked.
- **`journey_ready` = catalog depth ≥ 8** (non-generic). **UI entry** (search, collection map, subject shell) additionally requires **cached** works (`qualifying_work_count > 0`) so empty journeys never open. Uncached dump subjects stay in the DB for later enrich.
- **Connections = journey_ready ↔ journey_ready** co-occurrence only — avoids noisy browse_only spokes.
- **Journey plots all cached dated+imaged works** (chronological, horizontal scroll), not a 4-per-period featured sample. Full dump IDs wait on later bulk cache.
- **Shareable URL state** (`?chapter=`, `?artwork=`) as product truth — no accounts.
- **Shimmer skeletons** over raw “Loading…” for submission polish.

## Hard parts / dead ends

- **AIC IIIF / Cloudflare** — blocked runtime and Vercel fetch; pivoted to Met JPEGs.
- **Full Met CSV enrich** — Incapsula **403** + timeouts; subject-scoped job for Coat Of Arm reached ~2400/2732 then died on connect timeout; resume via checkpoint.
- **On-demand enrich vs “106 works” badge** — badge is qualifying/catalog depth; journey only has *cached* rows until enrich/bulk job fills them.
- **Next 15 + `dynamic({ ssr: false })` in a Server Component** — 500 on home; fixed by importing the client graph and using a `mounted` guard.
- **Naive singularization** (`canvas` → `canva`) — fixed with a do-not-singularize set.
- **React Flow SSR/hydration** — mount after `useEffect`; avoid SSR transform mismatch.

## How I verified it works

- `npm test` — Vitest 41 (normalize, validate, URL state, Met retry/backoff, connections helpers)
- `npm run lint` / `npx tsc --noEmit` / `npm run build` on polished tree
- Local smoke: search → Flower/Putti journey → epoch chips → `?artwork=` inspect → Connections; brand → `/`
- Production alias smoked earlier for journey-ready subjects; redeploy via GitHub `main`

**With more time:** Lighthouse on mid-range mobile, Playwright path suite, finish Coat Of Arm (and peers) bulk cache, manual image relevance sampling.

## Known limitations

- Homepage Collection map and search only list **journey_ready** subjects with **cached** works (`qualifying_work_count > 0`). Dump tags / uncached terms stay in Supabase for later enrich; they are not clickable empty journeys.
- Journey shows **cached** works only; `catalog_work_count` can be much larger until enrich/bulk jobs finish.
- Enrich needs `SUPABASE_SERVICE_ROLE_KEY` on Vercel; without it, first visits stay DB-only.
- Bulk Met fetches still hit **403/timeouts**; not production-critical for the demo path.
- Legacy Met exhibition-maker files remain in the repo but unused by the home route.
- Manual ≥80% visual relevance review for launch subjects still pending.
- Connections ignore browse_only targets by design.

## Time spent

| Phase | ~Hours |
| --- | ---: |
| Early Met exhibition maker (pivoted away) | 6–7 |
| Docs / product pivot | 1 |
| Supabase schema + ingest/tag index + connections | 4–5 |
| Subject UI (journey, connections, home map) | 4–5 |
| On-demand enrich + polish (skeletons, scroll, docs) | 2–3 |
| **Total** | **~17–20** |
