# Project Brief: Subject Museum

Status: product concept; Journey, All Works, and Connections are the committed core pages. Name and lower-level implementation choices remain provisional. Working title in this repo: Museum Exhibition.

Previous direction: a three-work Met exhibition maker (replace / reorder / title, no database). That product is superseded by this brief. Historical notes remain in `docs/IMPLEMENTATION_PLAN.md`, `docs/content-audit.md`, and `data/subjects.json` until the new ingest produces launch subjects.

## The Idea

A searchable digital museum devoted to the things we usually overlook. Visitors can enter any subject, from "window" to "wheelchair," and discover whether the collection contains a meaningful visual history of it. Valid subjects are discovered from the museum's catalog data and indexed in Supabase; they are not limited to a predetermined menu.

The pleasure comes from noticing: the same ordinary thing can be practical, intimate, symbolic, or strange depending on the artist. The app makes that comparison accessible without requiring visitors to know artists, movements, or art-history terminology.

One-sentence pitch: **Type a thing. See how artists have pictured it across time.**

## Assessment Fit

This project is for the **Creative, API-Integrated Web App** assignment.

The submission must demonstrate:

- A beautiful, fast web app using at least one third-party API.
- A distinctive UI that does not feel like a default dashboard.
- Smooth animation and strong perceived performance.
- Proper loading, empty, error, and failure states.
- Good frontend and backend practices.
- Clear documentation covering features, architecture, setup, API quirks, testing, and known limitations.
- At least one advanced feature.

This project targets:

- **Primary:** Own backend / BFF — dump ingestion, subject validation, Supabase indexing, Next.js route handlers, server-side credentials, and graceful live-API fallback.
- **Secondary:** Signature animation — chapter advance on Journey plus a shared-element or FLIP-style transition into artwork inspection.
- **Supporting:** Shareable URL state for subject, page, filters, period or connection, and selected artwork, restored through validated server-backed requests.

## Who It Is For

Curious visitors, design-minded people, casual museumgoers, and anyone who likes collecting images or noticing details. The primary visit should take a few minutes and produce something worth sending to a friend.

The product is a focused way to move through museum data by subject. Its central user journey is: search for a thing, follow its visual history, inspect works, and share the journey.

## What the Finished App Looks Like

### First Screen: Search the Collection

The first screen opens with a prominent search field and one example journey already visible. Search suggestions come from validated subjects in Supabase and show useful context, such as "window - 28 works - 1648 to 1932." Suggestions are discoveries from the indexed collection rather than a fixed product taxonomy.

The desktop composition feels like an art book that unfolds through time. Artwork retains its original proportions and is shown uncropped. Works sit on an unframed white or light-gray surface, with dark text, fine rules, and a restrained accent color. Color comes primarily from the artwork itself.

Use expressive serif type for the exhibition title and readable sans-serif type for labels and controls. Avoid ornamental frames, fake wall textures, heavy shadows, and a dashboard-style card grid.

The next section begins within sight: a compact exhibition note or the start of the artwork labels provides a reason to continue scrolling. The opening experience is usable immediately, without a marketing page or onboarding barrier.

### Search Any Valid Subject

The search box queries the validated subject index. It accepts free text, handles singular/plural aliases, and offers close valid alternatives. A visitor may search for any word; the app only opens a journey when the stored evidence meets the validation requirements below.

Selecting a subject loads its journey. The current layout stays stable while artwork-shaped skeletons appear. Once ready, the works enter in chronological order.

If a query is not valid, the app explains why in useful language: "We found only two displayable works for wheelchair" or "Computer appears in the catalog, but the matching images are not public domain." It then suggests nearby valid subjects based on shared catalog terms.

## The Three Core Pages

Every valid subject has three coordinated pages: **Journey**, **All Works**, and **Connections**. They share the same search field, subject header, artwork inspection view, and URL-synced state. A compact view switcher remains visible near the subject title so visitors can change perspective without beginning a new search.

Suggested routes:

- `/subject/window/journey`
- `/subject/window/works`
- `/subject/window/connections`

The selected artwork opens through a query parameter or intercepted route, allowing the inspection view to retain the originating page and scroll position.

### 1. Journey

Journey is the default subject page and the product's main narrative experience. A horizontal date line anchors the experience on wide screens. Large featured works alternate with smaller groups, letting visitors move from the earliest representation to the latest without turning the page into a uniform image grid.

Each chapter represents a period derived from the available dates, not a hardcoded art-history label. A chapter may contain one anchor work and two or three supporting works. Short factual summaries report what the data supports, such as the number of works, media represented, and years covered. The app does not generate interpretations that the museum did not provide.

The number of visible works depends on the subject. A valid journey contains at least eight qualifying works. Dense subjects use a representative subset selected by relevance, date coverage, artist diversity, and media diversity; "All Works" exposes the complete qualifying set.

Journey uses `begin_year`, `end_year`, artwork relevance, artist, artwork type, and medium. Precomputed `term_periods` rows can store chapter boundaries, chapter counts, and featured artwork IDs so the layout remains stable and fast.

The Journey URL records the subject, active chapter, and selected artwork. On mobile, it becomes a vertical timeline with period markers beside the works.

### 2. All Works

All Works is the complete collection view for the subject. It uses a responsive image-first grid or masonry-like layout that preserves artwork proportions. It is intentionally denser than Journey and designed for scanning, comparison, and filtering.

Controls should be limited to useful fields supported across the data:

- Sort by date, relevance, artist, or title.
- Filter by date range, museum/source, artwork type, medium, and artist.
- Toggle between a visual grid and a compact list if implementation time permits.

Each result shows the artwork, title, artist, date, museum, and the metadata evidence that connected it to the subject. For example, a small label can say `Museum subject: window`. This makes the product's reasoning inspectable.

Filters are encoded in the URL. The view uses server-side pagination or cursor-based loading, image skeletons, responsive image sizes, and prefetching for the inspection view. It must preserve the user's filters and scroll position after closing an artwork.

All Works reads from `artwork_terms` joined to `artworks`; it does not rerun a fuzzy museum API search on every visit.

### 3. Connections

Connections reveals catalog concepts that repeatedly occur alongside the selected subject. For `window`, possible nodes might include `interiors`, `light`, `architecture`, and `domestic life`, but the actual nodes and counts are computed from ingested museum metadata.

The subject sits at the center of a restrained network. Four to eight strong related terms surround it. An edge represents qualifying artworks tagged with both terms; its visual strength reflects a normalized connection score. Small artwork previews sampled from the intersection make each relationship concrete.

Selecting a related term updates a supporting artwork strip to show works shared by both concepts. A visitor can then continue into the related subject's Journey, open the full intersection in All Works, or return to the original subject. Keyboard and list alternatives must expose the same relationships without requiring users to interpret or operate a spatial graph.

Connections are factual catalog co-occurrences, not claims about artistic meaning and not computer-vision detections. UI copy should say that terms are connected through shared museum metadata.

#### Connections Data

For the Art Institute, the primary inputs are `subject_titles` and `term_titles`. Supporting fields such as `style_titles`, `material_titles`, `technique_titles`, `classification_titles`, and `artwork_type_title` classify the kind of relationship. For The Met (a later collection), the equivalents are `tags`, `objectName`, `classification`, and `medium`; AAT URLs can help merge equivalent concepts.

During ingestion, create a normalized artwork-to-term relation for every accepted catalog term. Then generate pairs of terms that occur on the same qualifying artwork. Generic terms such as `art`, `painting`, `paper`, and `people` are excluded or heavily down-weighted.

Store precomputed edges in `term_connections`:

```text
source_term_id
target_term_id
shared_work_count
connection_score
sample_artwork_ids
computed_at
```

A practical first score is cosine-style co-occurrence normalization:

```text
shared artworks / sqrt(artworks with A * artworks with B)
```

Require at least three shared qualifying artworks, remove aliases of the same concept, and retain only the strongest edges per subject. This prevents globally common terms from dominating the graph. The score determines ordering and edge emphasis; it is not shown as an unexplained quality percentage.

Suggested endpoints:

- `GET /api/subjects/window/connections`
- `GET /api/artworks?terms=window,interiors`
- `GET /api/subjects/interiors/journey`

### Shared Artwork Inspection

Journey, All Works, and Connections use the same artwork inspection view. Selecting a work transitions it from its current context into a large image view with zoom, title, artist, date, medium, museum, metadata tags, museum-provided description when available, and a link to the original record.

Closing inspection returns to the exact originating page, filters, selected connection, and scroll position. Missing metadata is handled cleanly rather than filled with invented content. Zoom has buttons and a reset control; it must not depend only on gestures.

### Share the Current View

A share control copies a URL containing the subject, current page, active filters, selected period or connection, and selected artwork. Opening it reconstructs the same state in Journey, All Works, or Connections.

No account is necessary. Refreshing or using browser back/forward preserves meaningful state. Local storage may remember a visitor's last subject and page, but the URL is the source of truth for shared views.

### Mobile Experience

On mobile, Journey becomes a vertical timeline, All Works becomes a two-column or single-column grid based on available width, and Connections defaults to a ranked relationship list with an optional compact graph. Images remain fully visible within sensible height limits, and the inspection view uses the full screen.

## Example Visit

1. A visitor types "window" and sees that the index contains a valid journey spanning several centuries.
2. They move through chronological chapters and notice how the subject shifts across media and settings.
3. They inspect one work, zoom into a detail, and return to the same timeline position.
4. They switch to "All works" and filter the subject by medium.
5. They open Connections and discover that `window` frequently appears with `interiors` and `light`.
6. They inspect the shared works, continue into the `interiors` Journey, or share the current connection.

## Ingestion, Analysis, and Supabase

Use the [Art Institute of Chicago API](https://api.artic.edu/docs/) as the initial source. For bulk analysis, use the museum's official data dump rather than scraping the paginated API. The documentation specifically recommends dumps when copying more than 10,000 records or enhancing/analyzing the data; API scraping is limited to 10,000 search results and should be throttled to one request per second.

An ingestion script downloads the current dump, normalizes artwork records, extracts candidate terms, computes subject statistics, and upserts the results into Supabase. The app reads the indexed data from Supabase and constructs image URLs against the museum's IIIF service. It does not copy image files into Supabase Storage.

Store only the fields the product needs: source ID, title, artist, dates, medium, artwork type, image ID, image dimensions, alt text, public-domain status, source URL, `subject_titles`, `term_titles`, and a normalized searchable document. Museum descriptions are optional and should be sanitized if rendered.

Candidate words come primarily from `subject_titles` and `term_titles`. Title tokens and descriptions may add supporting evidence but cannot make a subject valid alone. Search metadata is not object detection: the index can say that a catalog record associates a work with "window," but it cannot prove where or how a window appears in the image.

### Concrete Subject Validation Requirements

A subject is **valid** (journey-ready) only when every hard requirement passes:

1. **Language:** after lowercasing, Unicode normalization, singularization, and alias mapping, the subject is a meaningful noun or noun phrase. Reject stop words, numbers, isolated adjectives, artist names, generic catalog words such as "art" or "painting," and technical medium/material terms unless the product intentionally supports them.
2. **Exact catalog evidence:** each included artwork contains the canonical subject or an approved alias in `subject_titles` or `term_titles`. A title or description match can improve ranking but cannot qualify an artwork by itself.
3. **Displayable image:** `image_id` is present, the thumbnail reports usable width and height, and a small IIIF request succeeds during ingestion validation.
4. **Rights:** `is_public_domain = true` for the initial release. Preserve source attribution and the original record URL.
5. **Dated record:** a usable `date_start` or derived year is present. Uncertain ranges are retained, but undated works do not count toward journey coverage.
6. **Minimum depth:** at least 8 qualifying artworks remain after image, rights, relevance, and date checks.
7. **Temporal breadth:** qualifying works span at least 50 years and occupy at least 3 time buckets. Use data-derived buckets when possible; a practical fallback is century or 50-year intervals.
8. **Creator diversity:** at least 4 distinct artists/makers, with no single maker supplying more than 40% of the default journey.
9. **Presentational diversity:** at least 2 artwork types or media when available. This is a ranking requirement rather than an automatic rejection when an otherwise strong subject is concentrated in one medium.
10. **Relevance quality:** a deterministic sample of up to 12 qualifying works receives manual review before launch. At least 80% must clearly relate to the subject from the title, museum tags, description, or alt text. Store the review result and reason.

Useful status bands:

- **Journey-ready:** all hard requirements pass; the subject appears in autocomplete and can open a chronological journey.
- **Browse-only:** 3–7 displayable relevant works, or enough works without sufficient temporal breadth. It may open a compact results view but is not promoted as a journey.
- **Unavailable:** fewer than 3 displayable relevant works, poor relevance, or rights/image failures. Show the reason and nearby valid subjects.

The exact numbers are initial product thresholds and should be adjusted after analyzing the dump. They are explicit enough to test and explain, while avoiding the misleading raw search totals returned by broad fuzzy queries.

Launch subjects are discovered from the dump, not a hardcoded menu. Ship at least three journey-ready subjects after validation.

### Suggested Supabase Tables

- `artworks`: normalized museum records and display fields, keyed by `(source, source_id)`.
- `terms`: canonical subjects, display labels, aliases, status, counts, date range, diversity statistics, review status, and validation reasons.
- `artwork_terms`: artwork-to-term relationships with evidence source (`subject`, `term`, `title`, or `description`) and a relevance weight.
- `term_connections`: precomputed co-occurrence edges with shared-work counts, normalized scores, and representative artwork IDs.
- `ingestion_runs`: source version, timestamps, totals, rejected counts, and error summaries.
- `term_periods`: precomputed Journey chapters, counts, and featured artwork IDs for fast, stable page loads.

Use PostgreSQL full-text search or trigram matching for autocomplete and aliases. `pgvector` is optional for related-subject suggestions; it is not necessary for the first version and should not decide factual relevance by itself.

## Why Our Own Backend Makes Sense

The backend turns a raw museum dump into a validated, searchable subject index and serves journey-ready results. This is substantial product logic, not a proxy.

Use Next.js route handlers plus Supabase in this project's own repository. Frontend and route handlers deploy together; the ingestion script can run locally for the assessment and be documented as a scheduled job for a production version.

Suggested responsibilities:

- Download and process the official data dump without burdening the live API.
- Normalize terms, aliases, artwork dates, rights, and image metadata.
- Compute validation status and record the reason for every rejection.
- Serve debounced autocomplete, Journey chapters, All Works filters, Connections edges, intersections, and artwork details from Supabase.
- Refresh a record from the live museum API when detail freshness matters, with caching and bounded retry/backoff.
- Return a small, stable response shape to the frontend and preserve source attribution.

Possible endpoints: `GET /api/subjects?q=wind`, `GET /api/subjects/window/journey`, `GET /api/subjects/window/works`, `GET /api/subjects/window/connections`, and `GET /api/artworks/154235`. Final endpoint design can change during implementation.

The museum API does not require a key, so secret storage is not the reason for this backend. The value is ingestion, quality analysis, reliable search, precomputed chronology, and transparent validation. Supabase service credentials remain server-side; public read access should expose only the intended views or RPC functions.

## Scope for the Assessment

### Must Ship

- A reproducible sample ingestion into Supabase.
- The concrete validation pipeline with stored rejection reasons.
- Debounced autocomplete from the validated subject index.
- At least three Journey-ready subjects discovered from data.
- Journey, All Works, and Connections pages for each of those subjects.
- Shared artwork inspection.
- Shareable URL state.
- One signature transition (chapter advance and/or inspection).
- Responsive, accessible loading, empty, and error states.
- README, BUILD_LOG.md, setup instructions, architecture notes, and testing notes.

### Optional After the Core Works

- Richer image zoom (for example OpenSeadragon / IIIF tiles).
- Visitor-curated exhibitions.
- Automated embeddings for related-subject suggestions.
- A downloadable Journey image.
- Grid/list toggle on All Works.

### Out of Scope for This Assessment

- User accounts.
- Private saved collections.
- Multiple museums in the first release (The Met remains a future fusion candidate).
- Visitor-authored exhibition essays.
- Computer-vision object detection.
- Copying image binaries into Supabase Storage.

## Verification and Deliverables

- Verify every launch subject against all hard validation requirements and retain the reasons for rejected terms.
- Test ingestion idempotency: rerunning the same source data must update rather than duplicate records.
- Check aliases, singular/plural searches, typo handling, browse-only terms, and unavailable terms.
- Verify connection edges against shared artwork IDs and ensure generic terms do not dominate.
- Confirm Journey, All Works, and Connections preserve their state when moving into and out of artwork inspection.
- Verify no duplicate artworks within a journey, stable image proportions, and clean handling of missing metadata.
- Open shared URLs in a fresh browser session; test invalid subjects, filters, artwork IDs, refresh, and back/forward navigation.
- Simulate Supabase and museum failures; confirm the app distinguishes missing data from an unavailable upstream.
- Check keyboard navigation, inspection focus return, reduced motion, and narrow mobile layouts.
- Inspect animation and loading performance on a mid-range device profile.
- Deliver a separate source repository, live deployment, README, and BUILD_LOG.md describing decisions, time spent, API quirks, advanced features, and known limitations.

## References and What to Borrow

These are direction references, not designs to copy.

| Reference | Relevance |
| --- | --- |
| [Art Institute of Chicago collection](https://www.artic.edu/collection) | Initial data provider; imagery and collection metadata. |
| [Art Institute API documentation](https://api.artic.edu/docs/) | Search, fields, IIIF image delivery, rights, dump guidance. |
| [Art UK Discover artworks](https://artuk.org/discover/artworks) | Closest discovery workflow: search people/places/things; keep free-text search central and show what is actually displayable. |
| [The Public Domain Review Collections](https://publicdomainreview.org/collections/) | Editorial voice, typography, and thematic invitation without inventing museum facts. |
| [Are.na](https://www.are.na/about) | Selecting and arranging images can create meaning; useful for later curations, not the first release. |
| [Cooper Hewitt collection](https://collection.cooperhewitt.org/) | Everyday objects treated with serious, readable collection context. |
| [Europeana Collections](https://europeana.eu/en/collections) | Multi-institution discovery; relevant if a second museum is added later. |
| [OpenSeadragon IIIF example](https://openseadragon.github.io/examples/tilesource-iiif/) | Deep zoom for inspection if time permits. |
| [art-institute-of-chicago/api-data](https://github.com/art-institute-of-chicago/api-data) | Real record shapes for development and missing-field checks. |
| [metmuseum/openaccess](https://github.com/metmuseum/openaccess) | Future second collection; map fields into one artwork model while keeping provider IDs and attribution. |

## Why This Is a Strong Submission

The concept has an identifiable personality, a focused discovery journey, and real artwork as its main visual asset. The backend addresses actual ingestion, data-quality, and search problems, while the chronological presentation and inspection transition demonstrate visible technical craft. A reviewer can search for an ordinary thing, understand why it qualifies, and travel through its visual history within a few minutes.
