-- SECURITY DEFINER helper for bulk artwork upsert (service_role / privileged SQL).
CREATE OR REPLACE FUNCTION public.ingest_upsert_artworks(rows jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n integer;
BEGIN
  INSERT INTO public.artworks (
    source, source_id, title, artist_title, date_start, date_end, date_display,
    medium_display, artwork_type_title, image_id, image_width, image_height,
    alt_text, is_public_domain, source_url, subject_titles, term_titles, raw_department
  )
  SELECT
    coalesce(r->>'source', 'artic'),
    r->>'source_id',
    nullif(r->>'title', ''),
    nullif(r->>'artist_title', ''),
    (r->>'date_start')::integer,
    (r->>'date_end')::integer,
    nullif(r->>'date_display', ''),
    nullif(r->>'medium_display', ''),
    nullif(r->>'artwork_type_title', ''),
    nullif(r->>'image_id', ''),
    (r->>'image_width')::integer,
    (r->>'image_height')::integer,
    nullif(r->>'alt_text', ''),
    coalesce((r->>'is_public_domain')::boolean, false),
    r->>'source_url',
    coalesce(ARRAY(SELECT jsonb_array_elements_text(r->'subject_titles')), '{}'),
    coalesce(ARRAY(SELECT jsonb_array_elements_text(r->'term_titles')), '{}'),
    nullif(r->>'raw_department', '')
  FROM jsonb_array_elements(rows) AS r
  ON CONFLICT (source, source_id) DO UPDATE SET
    title = EXCLUDED.title,
    artist_title = EXCLUDED.artist_title,
    date_start = EXCLUDED.date_start,
    date_end = EXCLUDED.date_end,
    date_display = EXCLUDED.date_display,
    medium_display = EXCLUDED.medium_display,
    artwork_type_title = EXCLUDED.artwork_type_title,
    image_id = EXCLUDED.image_id,
    image_width = EXCLUDED.image_width,
    image_height = EXCLUDED.image_height,
    alt_text = EXCLUDED.alt_text,
    is_public_domain = EXCLUDED.is_public_domain,
    source_url = EXCLUDED.source_url,
    subject_titles = EXCLUDED.subject_titles,
    term_titles = EXCLUDED.term_titles,
    raw_department = EXCLUDED.raw_department,
    updated_at = now();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_upsert_artworks(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_upsert_artworks(jsonb) TO service_role;
