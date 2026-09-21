/**
 * Compute term_connections from object_tags dump co-occurrence.
 * Also rebuilds term_periods for journey_ready subjects that have cached dated artworks.
 *
 * Usage: npm run ingest:connections
 */
import { createClient } from "@supabase/supabase-js";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import {
  computeConnections,
  type ConnectionEdge,
  type TermMeta,
} from "../../src/lib/index/connections";
import { computeTermPeriods } from "../../src/lib/index/periods";
import { CATALOG_JOURNEY_MIN } from "../../src/lib/index/validate";

config({ path: ".env.local" });

const DATA = path.resolve(process.cwd(), "data/met");
const LAUNCH = ["flower", "landscape", "animal", "horse", "portrait"] as const;
const PAGE = 1000;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

async function fetchAll<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: () => any,
): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await query().range(from, from + PAGE - 1);
    if (error) throw error;
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return rows;
}

async function main() {
  await mkdir(DATA, { recursive: true });
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  type TermRow = {
    id: string;
    canonical: string;
    slug: string;
    aliases: string[] | null;
    status: TermMeta["status"];
    catalog_work_count: number;
  };

  const terms = await fetchAll<TermRow>(() =>
    supabase
      .from("terms")
      .select("id, canonical, slug, aliases, status, catalog_work_count"),
  );

  // Ensure dump-deep terms are journey_ready before scoring.
  for (const t of terms) {
    if (t.catalog_work_count >= CATALOG_JOURNEY_MIN && t.status !== "journey_ready") {
      t.status = "journey_ready";
    }
  }

  const termMeta: TermMeta[] = terms.map((t) => ({
    id: t.id,
    canonical: t.canonical,
    slug: t.slug,
    aliases: t.aliases ?? [],
    status: t.status,
  }));
  const termIdBySlug = new Map(terms.map((t) => [t.slug, t.id]));
  const readySlugs = new Set(
    terms
      .filter((t) => t.status === "journey_ready")
      .map((t) => t.slug),
  );

  console.log(`terms=${terms.length} journey_ready=${readySlugs.size}`);

  type TagRow = { source_id: string; slug: string };
  const tags = await fetchAll<TagRow>(() =>
    supabase.from("object_tags").select("source_id, slug"),
  );
  console.log(`object_tags=${tags.length}`);

  /** source_id → set of term UUIDs (journey_ready slugs only). */
  const artworkTermSets = new Map<string, Set<string>>();

  for (const row of tags) {
    if (!readySlugs.has(row.slug)) continue;
    const termId = termIdBySlug.get(row.slug);
    if (!termId) continue;
    let set = artworkTermSets.get(row.source_id);
    if (!set) {
      set = new Set();
      artworkTermSets.set(row.source_id, set);
    }
    set.add(termId);
  }

  console.log(`tagged objects used=${artworkTermSets.size}`);

  const edges = computeConnections({
    terms: termMeta,
    artworkTermSets,
    minShared: 3,
    topK: 8,
  });

  // Remap sample_artwork_ids: computeConnections stored Met source_ids as "artwork" keys.
  // Resolve to artworks.id when cached; otherwise clear samples.
  const sampleSourceIds = [
    ...new Set(edges.flatMap((e) => e.sample_artwork_ids)),
  ];
  const uuidBySource = new Map<string, string>();
  for (let i = 0; i < sampleSourceIds.length; i += 100) {
    const chunk = sampleSourceIds.slice(i, i + 100);
    if (!chunk.length) continue;
    const { data, error } = await supabase
      .from("artworks")
      .select("id, source_id")
      .eq("source", "met")
      .in("source_id", chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      uuidBySource.set(row.source_id as string, row.id as string);
    }
  }

  const edgesOut: ConnectionEdge[] = edges.map((e) => ({
    ...e,
    sample_artwork_ids: e.sample_artwork_ids
      .map((sid) => uuidBySource.get(sid))
      .filter((id): id is string => !!id)
      .slice(0, 5),
  }));

  console.log(`connections=${edgesOut.length}`);

  await supabase.from("term_connections").delete().gte("shared_work_count", 0);
  for (let i = 0; i < edgesOut.length; i += 100) {
    const { error } = await supabase
      .from("term_connections")
      .upsert(edgesOut.slice(i, i + 100));
    if (error) throw error;
  }

  // Periods only for subjects that already have cached dated artworks.
  type ArtRow = {
    id: string;
    source_id: string;
    date_start: number | null;
    artist_title: string | null;
    is_public_domain: boolean;
    image_id: string | null;
    image_url: string | null;
    image_url_small: string | null;
  };
  const artworks = await fetchAll<ArtRow>(() =>
    supabase
      .from("artworks")
      .select(
        "id, source_id, date_start, artist_title, is_public_domain, image_id, image_url, image_url_small",
      )
      .eq("source", "met"),
  );
  const hasImage = (a: ArtRow) =>
    !!(a.image_url_small || a.image_url || a.image_id);
  const artById = new Map(artworks.map((a) => [a.id, a]));

  const links = await fetchAll<{ artwork_id: string; term_id: string }>(() =>
    supabase
      .from("artwork_terms")
      .select("artwork_id, term_id")
      .in("evidence_source", ["term", "subject", "tag"]),
  );

  let periodRows = 0;
  const readyTerms = termMeta.filter((t) => t.status === "journey_ready");
  // Only recompute periods for terms that have at least one link (avoid wiping all).
  const termIdsWithLinks = new Set(links.map((l) => l.term_id));
  for (const t of readyTerms) {
    if (!termIdsWithLinks.has(t.id)) continue;
    const artIds = links
      .filter((l) => l.term_id === t.id)
      .map((l) => l.artwork_id);
    const dated = artIds
      .map((id) => artById.get(id))
      .filter(
        (a): a is ArtRow =>
          !!a &&
          a.is_public_domain &&
          hasImage(a) &&
          a.date_start != null,
      )
      .map((a) => ({
        id: a.id,
        date_start: a.date_start!,
        artist_title: a.artist_title,
      }));
    const periods = computeTermPeriods(t.id, dated);
    await supabase.from("term_periods").delete().eq("term_id", t.id);
    if (!periods.length) continue;
    const payload = periods.map((p) => ({
      term_id: t.id,
      period_index: p.period_index,
      label: p.label,
      begin_year: p.begin_year,
      end_year: p.end_year,
      work_count: p.work_count,
      featured_artwork_ids: p.featured_artwork_ids,
    }));
    const { error } = await supabase.from("term_periods").upsert(payload, {
      onConflict: "term_id,period_index",
    });
    if (error) throw error;
    periodRows += payload.length;
  }
  console.log(`periods=${periodRows}`);

  for (const slug of LAUNCH) {
    const t = termMeta.find((x) => x.slug === slug);
    const { count } = await supabase
      .from("term_connections")
      .select("*", { count: "exact", head: true })
      .eq("source_term_id", t?.id ?? "");
    console.log(`launch ${slug}: status=${t?.status} edges=${count}`);
  }

  await writeFile(
    path.join(DATA, "connections-summary.json"),
    JSON.stringify(
      {
        edges: edgesOut.length,
        periods: periodRows,
        journey_ready: readySlugs.size,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
