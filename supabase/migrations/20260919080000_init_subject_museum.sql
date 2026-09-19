-- Phase 1: subject museum index (Art Institute of Chicago)
-- Applied remotely to project soavlmfrtmobmgesccrp via Supabase MCP.

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE TYPE public.term_status AS ENUM ('journey_ready', 'browse_only', 'unavailable');
CREATE TYPE public.evidence_source AS ENUM ('subject', 'term', 'title', 'description');

CREATE TABLE public.artworks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'artic',
  source_id text NOT NULL,
  title text,
  artist_title text,
  date_start integer,
  date_end integer,
  date_display text,
  medium_display text,
  artwork_type_title text,
  image_id text,
  image_width integer,
  image_height integer,
  alt_text text,
  is_public_domain boolean NOT NULL DEFAULT false,
  source_url text,
  subject_titles text[] NOT NULL DEFAULT '{}',
  term_titles text[] NOT NULL DEFAULT '{}',
  searchable tsvector,
  raw_department text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source, source_id)
);

CREATE TABLE public.terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  canonical text NOT NULL,
  display_label text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  status public.term_status NOT NULL DEFAULT 'unavailable',
  qualifying_work_count integer NOT NULL DEFAULT 0,
  date_min integer,
  date_max integer,
  artist_count integer NOT NULL DEFAULT 0,
  artwork_type_count integer NOT NULL DEFAULT 0,
  medium_count integer NOT NULL DEFAULT 0,
  max_artist_share numeric(5,4),
  year_span integer,
  bucket_count integer NOT NULL DEFAULT 0,
  validation_reasons text[] NOT NULL DEFAULT '{}',
  review_status text,
  review_notes text,
  search_document tsvector,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.artwork_terms (
  artwork_id uuid NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  evidence_source public.evidence_source NOT NULL,
  relevance_weight numeric(4,3) NOT NULL DEFAULT 1.0,
  PRIMARY KEY (artwork_id, term_id, evidence_source)
);

CREATE TABLE public.term_connections (
  source_term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  target_term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  shared_work_count integer NOT NULL DEFAULT 0,
  connection_score numeric(10,6) NOT NULL DEFAULT 0,
  sample_artwork_ids uuid[] NOT NULL DEFAULT '{}',
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_term_id, target_term_id),
  CHECK (source_term_id <> target_term_id)
);

CREATE TABLE public.ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL DEFAULT 'artic',
  source_version text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  artworks_upserted integer NOT NULL DEFAULT 0,
  terms_upserted integer NOT NULL DEFAULT 0,
  artwork_terms_upserted integer NOT NULL DEFAULT 0,
  rejected_term_count integer NOT NULL DEFAULT 0,
  journey_ready_count integer NOT NULL DEFAULT 0,
  browse_only_count integer NOT NULL DEFAULT 0,
  unavailable_count integer NOT NULL DEFAULT 0,
  error_summary text,
  notes text
);

CREATE TABLE public.term_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  term_id uuid NOT NULL REFERENCES public.terms(id) ON DELETE CASCADE,
  period_index integer NOT NULL,
  label text NOT NULL,
  begin_year integer,
  end_year integer,
  work_count integer NOT NULL DEFAULT 0,
  featured_artwork_ids uuid[] NOT NULL DEFAULT '{}',
  UNIQUE (term_id, period_index)
);

CREATE INDEX artworks_image_id_idx ON public.artworks (image_id) WHERE image_id IS NOT NULL;
CREATE INDEX artworks_pd_dated_idx ON public.artworks (is_public_domain, date_start)
  WHERE is_public_domain AND date_start IS NOT NULL;
CREATE INDEX artworks_searchable_idx ON public.artworks USING gin (searchable);
CREATE INDEX terms_status_idx ON public.terms (status);
CREATE INDEX terms_search_idx ON public.terms USING gin (search_document);
CREATE INDEX terms_canonical_trgm_idx ON public.terms USING gin (canonical gin_trgm_ops);
CREATE INDEX artwork_terms_term_id_idx ON public.artwork_terms (term_id);
CREATE INDEX artwork_terms_artwork_id_idx ON public.artwork_terms (artwork_id);
CREATE INDEX term_connections_score_idx ON public.term_connections (source_term_id, connection_score DESC);

CREATE OR REPLACE FUNCTION public.artworks_searchable_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.searchable :=
    setweight(to_tsvector('english', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.artist_title, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.subject_titles, ' '), '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.term_titles, ' '), '')), 'B');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER artworks_searchable_tg
  BEFORE INSERT OR UPDATE OF title, artist_title, subject_titles, term_titles
  ON public.artworks
  FOR EACH ROW EXECUTE FUNCTION public.artworks_searchable_trigger();

CREATE OR REPLACE FUNCTION public.terms_search_trigger() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_document :=
    setweight(to_tsvector('english', coalesce(NEW.canonical, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.display_label, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.aliases, ' '), '')), 'B');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER terms_search_tg
  BEFORE INSERT OR UPDATE OF canonical, display_label, aliases
  ON public.terms
  FOR EACH ROW EXECUTE FUNCTION public.terms_search_trigger();

ALTER TABLE public.artworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artwork_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.term_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingestion_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.term_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY artworks_public_read ON public.artworks
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY terms_public_read ON public.terms
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY artwork_terms_public_read ON public.artwork_terms
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY term_connections_public_read ON public.term_connections
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY term_periods_public_read ON public.term_periods
  FOR SELECT TO anon, authenticated USING (true);
-- ingestion_runs: no public read (ops only via service role)
