-- Met pivot: image URLs + tag evidence; clear AIC rows for reload
ALTER TABLE public.artworks
  ALTER COLUMN source SET DEFAULT 'met';

ALTER TABLE public.artworks
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_url_small text;

-- Prefer Met JPEG URLs; keep image_id nullable for legacy AIC rows
COMMENT ON COLUMN public.artworks.image_url IS 'Met primaryImage (full JPEG URL)';
COMMENT ON COLUMN public.artworks.image_url_small IS 'Met primaryImageSmall JPEG URL';
COMMENT ON COLUMN public.artworks.subject_titles IS 'Met tags (and legacy AIC subjects)';
COMMENT ON COLUMN public.artworks.term_titles IS 'Additional Met tags / legacy AIC terms';

DO $$ BEGIN
  ALTER TYPE public.evidence_source ADD VALUE IF NOT EXISTS 'tag';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Clean index for Met reload
TRUNCATE public.term_connections, public.term_periods, public.artwork_terms,
  public.terms, public.artworks, public.ingestion_runs RESTART IDENTITY CASCADE;
