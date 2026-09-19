# Met Open Access data

Bulk file: [MetObjects.csv](https://github.com/metmuseum/openaccess) via `npm run ingest:download` (~318MB, gitignored).

The CSV has **no image URLs**. Full index load:

1. `npm run ingest:csv-filter` — PD + non-empty Tags + Object Begin Date → `eligible-ids.json`
2. `MET_CSV_FRESH=1 npm run ingest:csv` — truncate, Collection API enrich, upsert, rebuild terms
3. `npm run ingest:connections`

Live API: https://collectionapi.metmuseum.org — see https://metmuseum.github.io/
