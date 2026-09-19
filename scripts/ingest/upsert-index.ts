/**
 * Shared Met index write path: artworks → terms → artwork_terms.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  extractCatalogTermLinks,
  slugifyTerm,
} from "../../src/lib/index/normalize";
import type { NormalizedArtwork } from "../../src/lib/index/types";
import { validateTerm, type TermAggregate } from "../../src/lib/index/validate";

export type IngestRunMeta = {
  source_version: string;
  notes: string;
};

export function artworkToRow(a: NormalizedArtwork) {
  return {
    source: "met" as const,
    source_id: a.source_id,
    title: a.title,
    artist_title: a.artist_title,
    date_start: a.date_start,
    date_end: a.date_end,
    date_display: a.date_display,
    medium_display: a.medium_display,
    artwork_type_title: a.artwork_type_title,
    image_url: a.image_url,
    image_url_small: a.image_url_small,
    image_id: a.image_url_small || a.image_url,
    image_width: a.image_width,
    image_height: a.image_height,
    alt_text: a.alt_text,
    is_public_domain: a.is_public_domain,
    source_url: a.source_url,
    subject_titles: a.subject_titles,
    term_titles: a.term_titles,
    raw_department: a.raw_department,
    updated_at: new Date().toISOString(),
  };
}

export async function upsertArtworks(
  supabase: SupabaseClient,
  artworks: NormalizedArtwork[],
  chunkSize = 100,
) {
  const payload = artworks.map(artworkToRow);
  for (let i = 0; i < payload.length; i += chunkSize) {
    const { error } = await supabase
      .from("artworks")
      .upsert(payload.slice(i, i + chunkSize), { onConflict: "source,source_id" });
    if (error) throw error;
  }
}

export async function startIngestionRun(
  supabase: SupabaseClient,
  meta: IngestRunMeta,
) {
  const { data, error } = await supabase
    .from("ingestion_runs")
    .insert({
      source: "met",
      source_version: meta.source_version,
      notes: meta.notes,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function fetchAllMetArtworks(
  supabase: SupabaseClient,
): Promise<NormalizedArtwork[]> {
  const PAGE = 1000;
  const out: NormalizedArtwork[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("artworks")
      .select(
        "source_id, title, artist_title, date_start, date_end, date_display, medium_display, artwork_type_title, image_url, image_url_small, image_id, image_width, image_height, alt_text, is_public_domain, source_url, subject_titles, term_titles, raw_department",
      )
      .eq("source", "met")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = data ?? [];
    for (const r of batch) {
      out.push({
        source: "met",
        source_id: r.source_id as string,
        title: (r.title as string | null) ?? null,
        artist_title: (r.artist_title as string | null) ?? null,
        date_start: (r.date_start as number | null) ?? null,
        date_end: (r.date_end as number | null) ?? null,
        date_display: (r.date_display as string | null) ?? null,
        medium_display: (r.medium_display as string | null) ?? null,
        artwork_type_title: (r.artwork_type_title as string | null) ?? null,
        image_url:
          (r.image_url as string | null) ??
          (r.image_id as string | null) ??
          null,
        image_url_small:
          (r.image_url_small as string | null) ??
          (r.image_id as string | null) ??
          null,
        image_width: (r.image_width as number | null) ?? null,
        image_height: (r.image_height as number | null) ?? null,
        alt_text: (r.alt_text as string | null) ?? null,
        is_public_domain: Boolean(r.is_public_domain),
        source_url: (r.source_url as string) ?? "",
        subject_titles: (r.subject_titles as string[]) ?? [],
        term_titles: (r.term_titles as string[]) ?? [],
        raw_department: (r.raw_department as string | null) ?? null,
      });
    }
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

/**
 * Rebuild terms + artwork_terms from Met artworks already in the DB
 * (or from the provided list). Uses evidence_source = tag.
 */
export async function rebuildTermsAndLinks(
  supabase: SupabaseClient,
  artworks?: NormalizedArtwork[],
) {
  const list = artworks ?? (await fetchAllMetArtworks(supabase));
  console.log(`Rebuilding terms from ${list.length} artworks`);

  const byCanonical = new Map<
    string,
    TermAggregate & { links: ReturnType<typeof extractCatalogTermLinks> }
  >();
  for (const a of list) {
    const links = extractCatalogTermLinks(a);
    for (const link of links) {
      let agg = byCanonical.get(link.canonical);
      if (!agg) {
        agg = {
          canonical: link.canonical,
          display_label: link.display_label,
          artworks: [],
          links: [],
        };
        byCanonical.set(link.canonical, agg);
      }
      if (!agg.artworks.some((x) => x.source_id === a.source_id)) {
        agg.artworks.push(a);
      }
      agg.links.push(link);
    }
  }

  const termPayload = [];
  const validations = [];
  for (const agg of byCanonical.values()) {
    const v = validateTerm(agg);
    validations.push(v);
    termPayload.push({
      slug: slugifyTerm(agg.canonical),
      canonical: agg.canonical,
      display_label: agg.display_label,
      aliases: [] as string[],
      status: v.status,
      qualifying_work_count: v.qualifying_work_count,
      date_min: v.date_min,
      date_max: v.date_max,
      year_span: v.year_span,
      bucket_count: v.bucket_count,
      artist_count: v.artist_count,
      artwork_type_count: v.artwork_type_count,
      medium_count: v.medium_count,
      max_artist_share: v.max_artist_share,
      validation_reasons: v.reasons,
      updated_at: new Date().toISOString(),
    });
  }

  for (let i = 0; i < termPayload.length; i += 100) {
    const { error } = await supabase
      .from("terms")
      .upsert(termPayload.slice(i, i + 100), { onConflict: "slug" });
    if (error) throw error;
  }
  console.log(`Upserted ${termPayload.length} terms`);

  const { data: artRows, error: artErr } = await supabase
    .from("artworks")
    .select("id, source_id")
    .eq("source", "met");
  if (artErr) throw artErr;
  const idBySource = new Map(
    (artRows ?? []).map((r) => [r.source_id as string, r.id as string]),
  );

  const { data: termRows, error: termErr } = await supabase
    .from("terms")
    .select("id, canonical");
  if (termErr) throw termErr;
  const termIdByCanonical = new Map(
    (termRows ?? []).map((t) => [t.canonical as string, t.id as string]),
  );

  const artIds = [...idBySource.values()];
  for (let i = 0; i < artIds.length; i += 50) {
    const { error } = await supabase
      .from("artwork_terms")
      .delete()
      .in("artwork_id", artIds.slice(i, i + 50));
    if (error) throw error;
  }

  const linkRows: Record<string, unknown>[] = [];
  for (const a of list) {
    const artworkId = idBySource.get(a.source_id);
    if (!artworkId) continue;
    for (const link of extractCatalogTermLinks(a)) {
      const termId = termIdByCanonical.get(link.canonical);
      if (!termId) continue;
      linkRows.push({
        artwork_id: artworkId,
        term_id: termId,
        evidence_source: "tag",
        relevance_weight: link.relevance_weight,
      });
    }
  }

  const seen = new Set<string>();
  const uniqueLinks = linkRows.filter((r) => {
    const k = `${r.artwork_id}:${r.term_id}:${r.evidence_source}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  for (let i = 0; i < uniqueLinks.length; i += 200) {
    const { error } = await supabase
      .from("artwork_terms")
      .upsert(uniqueLinks.slice(i, i + 200));
    if (error) throw error;
  }
  console.log(`Upserted ${uniqueLinks.length} artwork_terms`);

  return {
    artworks: list.length,
    terms: termPayload.length,
    links: uniqueLinks.length,
    validations,
    journey_ready: validations
      .filter((v) => v.status === "journey_ready")
      .map((v) => v.canonical),
  };
}
