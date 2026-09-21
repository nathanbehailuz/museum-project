-- CSV tag index for on-demand Met enrich (no API required to search).
-- catalog_work_count = eligible dump IDs for this slug; qualifying_work_count remains cached works.

ALTER TABLE public.terms
  ADD COLUMN IF NOT EXISTS catalog_work_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.object_tags (
  source_id text NOT NULL,
  slug text NOT NULL,
  tag text NOT NULL,
  PRIMARY KEY (source_id, slug)
);

CREATE INDEX IF NOT EXISTS object_tags_slug_idx ON public.object_tags (slug);

ALTER TABLE public.object_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS object_tags_public_read ON public.object_tags;
CREATE POLICY object_tags_public_read ON public.object_tags
  FOR SELECT TO anon, authenticated USING (true);

COMMENT ON TABLE public.object_tags IS
  'Met Open Access eligible object IDs × normalized tags from MetObjects.csv. Used to search and to know which IDs to fetch on demand.';
