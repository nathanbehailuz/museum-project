/**
 * Phase 2: compute term_connections + term_periods from the Phase 1 index.
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { createClient } from "@supabase/supabase-js";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import {
  computeConnections,
  type ArtworkTermLink,
  type TermMeta,
} from "../../src/lib/aic/connections";
import { computeTermPeriods } from "../../src/lib/aic/periods";

config({ path: ".env.local" });

const DATA = path.resolve(process.cwd(), "data/aic");
const LAUNCH = ["flower", "landscape", "animal"] as const;
const PAGE = 1000;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in .env.local`);
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
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  type ArtRow = {
    id: string;
    date_start: number | null;
    artist_title: string | null;
    is_public_domain: boolean;
    image_id: string | null;
  };
  type TermRow = {
    id: string;
    canonical: string;
    slug: string;
    aliases: string[] | null;
    status: TermMeta["status"];
  };

  const artworks = await fetchAll<ArtRow>(() =>
    supabase
      .from("artworks")
      .select("id, date_start, artist_title, is_public_domain, image_id")
      .eq("source", "artic"),
  );
  const qualifying = new Set(
    artworks
      .filter(
        (a) =>
          a.is_public_domain &&
          !!a.image_id &&
          a.date_start != null &&
          Number.isFinite(a.date_start),
      )
      .map((a) => a.id),
  );
  const artById = new Map(artworks.map((a) => [a.id, a]));

  const terms = await fetchAll<TermRow>(() =>
    supabase.from("terms").select("id, canonical, slug, aliases, status"),
  );
  const termMetas: TermMeta[] = terms.map((t) => ({
    id: t.id,
    canonical: t.canonical,
    slug: t.slug,
    aliases: t.aliases ?? [],
    status: t.status,
  }));
  const termById = new Map(termMetas.map((t) => [t.id, t]));
  const termByCanonical = new Map(termMetas.map((t) => [t.canonical, t]));

  const links = await fetchAll<ArtworkTermLink>(() =>
    supabase
      .from("artwork_terms")
      .select("artwork_id, term_id, evidence_source")
      .in("evidence_source", ["subject", "term"]),
  );

  const artworkTermSets = new Map<string, Set<string>>();
  for (const link of links) {
    if (!qualifying.has(link.artwork_id)) continue;
    let set = artworkTermSets.get(link.artwork_id);
    if (!set) {
      set = new Set();
      artworkTermSets.set(link.artwork_id, set);
    }
    set.add(link.term_id);
  }

  console.log(
    `qualifying artworks=${qualifying.size}; linked sets=${artworkTermSets.size}; terms=${termMetas.length}`,
  );

  const edges = computeConnections({ terms: termMetas, artworkTermSets });
  console.log(`connection edges=${edges.length}`);

  // Full refresh of connections for this sample index
  {
    const { error } = await supabase
      .from("term_connections")
      .delete()
      .neq("source_term_id", "00000000-0000-0000-0000-000000000000");
    if (error) throw error;
  }

  for (let i = 0; i < edges.length; i += 500) {
    const chunk = edges.slice(i, i + 500).map((e) => ({
      ...e,
      computed_at: new Date().toISOString(),
    }));
    const { error } = await supabase.from("term_connections").insert(chunk);
    if (error) throw error;
  }

  // Periods for all journey_ready terms
  const journeyReady = termMetas.filter((t) => t.status === "journey_ready");
  const periodRows = [];
  for (const t of journeyReady) {
    const works: { id: string; date_start: number; artist_title: string | null }[] =
      [];
    for (const [artworkId, set] of artworkTermSets) {
      if (!set.has(t.id)) continue;
      const art = artById.get(artworkId);
      if (!art || art.date_start == null) continue;
      works.push({
        id: art.id,
        date_start: art.date_start,
        artist_title: art.artist_title,
      });
    }
    periodRows.push(...computeTermPeriods(t.id, works));
  }

  const journeyIds = journeyReady.map((t) => t.id);
  if (journeyIds.length) {
    const { error } = await supabase
      .from("term_periods")
      .delete()
      .in("term_id", journeyIds);
    if (error) throw error;
  }
  for (let i = 0; i < periodRows.length; i += 500) {
    const { error } = await supabase
      .from("term_periods")
      .insert(periodRows.slice(i, i + 500));
    if (error) throw error;
  }
  console.log(`term_periods rows=${periodRows.length}`);

  const summary: Record<
    string,
    {
      edges: {
        target: string;
        shared: number;
        score: number;
        samples: string[];
      }[];
      periods: number;
    }
  > = {};

  for (const canonical of LAUNCH) {
    const src = termByCanonical.get(canonical);
    if (!src) {
      summary[canonical] = { edges: [], periods: 0 };
      continue;
    }
    const outbound = edges
      .filter((e) => e.source_term_id === src.id)
      .map((e) => ({
        target: termById.get(e.target_term_id)?.canonical ?? e.target_term_id,
        shared: e.shared_work_count,
        score: Number(e.connection_score.toFixed(6)),
        samples: e.sample_artwork_ids,
      }));
    summary[canonical] = {
      edges: outbound,
      periods: periodRows.filter((p) => p.term_id === src.id).length,
    };
  }

  await writeFile(
    path.join(DATA, "connections-summary.json"),
    JSON.stringify(
      { edge_count: edges.length, period_count: periodRows.length, launch: summary },
      null,
      2,
    ),
  );
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
