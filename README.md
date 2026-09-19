# Museum Exhibition Maker

Small exhibition maker: open a three-work show of everyday subjects in art, built with Next.js and [The Met Collection API](https://metmuseum.github.io/).

**Live:** https://museum-exhibition-iota.vercel.app

## Local setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test
npm run build
```

## Environment variables

None required. The Met Collection API does not use an API key. Do not commit secrets.

## Stack notes

- Next.js App Router + route handlers (BFF)
- Reviewed subject pools in `data/subjects.json`
- Images from `images.metmuseum.org`

Phase 3 adds curation, inspection, sharing, and a second subject (`chairs`). Query shape: `?subject=&ids=&title=`.

See `docs/` and `BUILD_LOG.md` for product and build notes.
