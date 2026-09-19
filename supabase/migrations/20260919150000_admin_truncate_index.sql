-- Truncate Subject Museum index for clean Met CSV reload (service_role only).
CREATE OR REPLACE FUNCTION public.admin_truncate_index()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  TRUNCATE public.term_connections, public.term_periods, public.artwork_terms,
    public.terms, public.artworks, public.ingestion_runs RESTART IDENTITY CASCADE;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_truncate_index() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_truncate_index() TO service_role;
