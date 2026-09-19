# Art Institute getting-started cache

Downloaded by `npm run ingest:download` from
[art-institute-of-chicago/api-data](https://github.com/art-institute-of-chicago/api-data):

- `allArtworks.jsonl` — all artworks, few fields (id, title, artist, department, accession)
- `someArtworks.csv` — ~300 highlighted works, same sparse fields

These files alone lack `subject_titles`, `term_titles`, `image_id`, dates, and
`is_public_domain`. The ingest script uses them as the **ID universe**, then
enriches records from the live AIC API (`api.artic.edu`) before upserting to
Supabase.

Do not commit the downloaded files (see `.gitignore` in this folder).
