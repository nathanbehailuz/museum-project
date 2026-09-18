# Project Brief: Museum Exhibition Maker

## Project Summary

Museum Exhibition Maker is a small digital museum experience about everyday things we usually overlook. A visitor chooses a familiar subject, such as windows, chairs, bowls, or hands, then explores how artists have represented that subject across different works. The visitor can assemble a three-work exhibition, inspect the artworks more closely, give the exhibition a title, and share the result with someone else.

One-sentence pitch: **Make a little exhibition about something you almost missed.**

The product is intentionally focused. It is not a full museum catalog, search engine, or art-history encyclopedia. It is a polished exhibition-making experience built around noticing, comparing, arranging, and sharing.

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

This project will target the following advanced features:

- **Primary advanced feature:** Own backend / backend-for-frontend using Next.js route handlers.
- **Secondary advanced feature:** Signature artwork-to-inspection transition.
- **Supporting feature:** Shareable URL state for exhibitions.

## Target Audience

The app is for curious visitors, design-minded people, casual museumgoers, and anyone who enjoys collecting images or noticing visual details.

The primary visit should take only a few minutes and produce something worth sharing. The visitor should not need to know artist names, museum terminology, art movements, or collection-search syntax.

## Core User Journey

1. The visitor opens the app and immediately sees a complete three-work exhibition.
2. They choose or keep an everyday subject.
3. They compare the three artworks.
4. They inspect one artwork in detail.
5. They replace any work that does not fit their preferred mood.
6. They reorder the works.
7. They name the exhibition.
8. They copy a shareable URL.
9. Another visitor opens the same exhibition and can create a variation.

## Product Scope

### Must Ship

- A default exhibition that is visible immediately on the first screen.
- A small set of verified subjects, ideally four or fewer.
- Three-work exhibitions.
- Artwork metadata fetched from a real museum API.
- Public-domain artwork images only.
- Replacement controls for each artwork.
- Accessible reorder controls.
- Editable exhibition title.
- Artwork inspection view.
- Shareable URL containing subject, title, selected artwork IDs, and order.
- Responsive desktop and mobile layouts.
- Loading skeletons shaped around the artwork layout.
- Empty and error states.
- Graceful behavior when the museum API fails or returns incomplete data.
- README, build log, setup instructions, architecture notes, and testing notes.

### Nice To Have

- Basic zoom controls inside the inspection view.
- Short editorial prompts for each subject.
- Debounced subject or artwork search.
- Drag-and-drop ordering.
- Downloadable exhibition image.

### Out Of Scope For This Assessment

- User accounts.
- Saved private collections.
- A database.
- Multi-museum search.
- Visitor-authored essays.
- Full catalog browsing.
- Complex annotation tools.

## Data Source

Use [The Met Collection API](https://metmuseum.github.io/) as the data source. No registration or API key is required. Prefer `/public/collection/v1.1/search` (paginated); `/v1/search` retires on 1 October 2026. Object records come from `/public/collection/v1/objects/{objectID}` and include JPEG URLs when open access.

The app should normalize only the fields it needs:

- Object ID.
- Title.
- Artist display name.
- Object date.
- Medium.
- Primary image URLs (`primaryImage`, `primaryImageSmall`).
- Public-domain status (`isPublicDomain`).
- Object URL on metmuseum.org.
- Optional tags or classification where useful.

The initial release combines a small manually reviewed pool of object IDs with live API-fetched metadata. This is important because a search term like `window` may match a title or tag without showing a visually relevant window, and `hasImages=true` does not guarantee an open-access JPEG. The reviewed pool is an editorial selection layer, not fabricated data. Launch config lives in `data/subjects.json`.

## Backend Approach

Use Next.js route handlers as a backend-for-frontend. The frontend should call this app's own API routes rather than calling the museum API directly from UI components.

The backend should:

- Validate supported subjects, artwork IDs, title lengths, and request limits.
- Fetch artwork metadata from The Met Collection API.
- Filter out records that are not public domain or lack a usable `primaryImage`.
- Normalize upstream records into a small frontend-friendly artwork shape.
- Exclude current selections when finding replacements.
- Cache normalized artwork metadata and subject pools with a documented expiry.
- Handle temporary upstream failures with bounded retry and backoff.
- Honor `Retry-After` when available.
- Return clear recoverable errors when data cannot be loaded.

Possible endpoint shape:

- `GET /api/exhibitions?subject=windows`
- `GET /api/artworks?ids=123,456,789`
- `GET /api/replacements?subject=windows&exclude=123,456`

The exact endpoint design can change during implementation, but the final README should document the actual architecture.

## Frontend Experience

The first screen should open directly into a real exhibition, not a marketing page or onboarding screen. The default exhibition can initially be titled `Windows`.

The desktop layout should feel like a gallery wall or art-book spread:

- Three artworks occupy most of the available space.
- Images retain their original proportions and remain uncropped.
- Labels include title, artist, and date.
- The surface is white or light gray.
- Text is dark and calm.
- Rules and accents are restrained.
- Color comes primarily from the artworks.

Avoid:

- Dashboard-style cards.
- Fake ornate frames.
- Heavy shadows.
- Decorative museum-wall textures.
- Unsupported art-historical claims.

Use expressive serif typography for the exhibition title and readable sans-serif typography for controls and labels.

## Interaction Requirements

### Subject Selection

The subject selector should offer a small tested set of everyday subjects. Candidate subjects include:

- Windows.
- Chairs.
- Bowls.
- Hands.

Final launch subjects should be chosen after checking that the API has enough relevant, public-domain, image-backed works.

Changing the subject should preserve layout stability while new artwork-shaped skeletons load.

### Curation

Each artwork should have a compact replacement control. Replacing one work should keep the other two selections intact and avoid duplicates.

The visitor should be able to reorder artworks using accessible move controls. Drag-and-drop can come later.

The visitor should be able to rename the exhibition. Title changes should update the shareable state.

### Inspection

Selecting an artwork should open a larger inspection view. The image should transition from its gallery position into the inspection view using transform and opacity-based motion.

The inspection view should show:

- Larger artwork image.
- Title.
- Artist.
- Date.
- Medium.
- Optional museum description if available and safe to render.
- Link to the original museum record.

Closing the inspection view should return focus to the artwork or control that opened it.

### Sharing

The share action should copy a URL that can reconstruct the exhibition. The URL should encode:

- Subject.
- Ordered artwork IDs.
- Custom exhibition title.
- Optional inspected artwork state if implemented.

The URL is the source of truth for shared views. Local storage can remember a visitor's last exhibition, but it should not be required for sharing.

## Accessibility And Responsive Requirements

The app should work well on mobile and desktop.

On mobile:

- The gallery becomes a vertical sequence of three artworks.
- Images stay fully visible within sensible height limits.
- Subject and share controls remain easy to reach.
- The inspection view uses the full screen.

Accessibility requirements:

- Semantic buttons and labels.
- Keyboard-operable curation controls.
- Visible focus states.
- Focus return after closing inspection.
- Reduced-motion support for the signature animation.
- No image-only controls without accessible names.

## Performance And States

The app should feel fast even while API data is loading.

Required states:

- Initial loading state.
- Artwork-shaped skeleton loading state.
- Empty state when a subject has no usable works.
- Recoverable API error state.
- Failed replacement state.
- Invalid shared URL state.

Performance goals:

- Smooth route and state transitions.
- No janky scrolling or layout shift during artwork replacement.
- Responsive images sized appropriately.
- Respectable Lighthouse score on a mid-range device profile.

## Verification Plan

Before submission, verify:

- Each launch subject has enough relevant artwork and replacement options.
- All displayed artworks have usable image IDs.
- Public-domain filtering is respected.
- Replacement does not create duplicates.
- Reordering preserves selected works.
- Custom titles survive refresh and sharing.
- Shared URLs open correctly in a fresh browser session.
- Invalid IDs and long titles are handled safely.
- Museum API errors produce a clear recoverable state.
- Cache and retry behavior works as documented.
- Keyboard navigation works.
- Inspection focus returns correctly.
- Reduced motion disables or simplifies the signature transition.
- Mobile layout does not crop or overlap important content.

## Deliverables

The final project should include:

- Live deployed URL.
- Public or reviewer-accessible source repository.
- `README.md`.
- `BUILD_LOG.md`.
- `.env.example`.
- This project brief.
- Documentation of API choice, architecture, advanced feature, testing, and known limitations.
- Optional but strongly recommended video walkthrough.

The walkthrough should demo the app and explain:

- One implementation detail worth being proud of.
- One hard part, shortcut, or limitation.

## Success Criteria

This is a strong submission if a reviewer can:

- Open the live app and immediately understand the experience.
- Create a small exhibition in a few minutes.
- Inspect real artwork from a real API.
- Share a URL that reconstructs the exhibition.
- See thoughtful visual design and motion.
- Read the docs and understand the architecture.
- Trust that the project handles API quirks, loading states, failures, and limitations honestly.

