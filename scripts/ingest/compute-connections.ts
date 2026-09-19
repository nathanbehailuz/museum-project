/**
 * Compute term_connections + term_periods from Met index.
 */
import { createClient } from "@supabase/supabase-js";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import {
  computeConnections,
  type ArtworkTermLink,
  type TermMeta,
} from "../../src/lib/index/connections";
import { computeTermPeriods } from "../../src/lib/index/periods";

config({ path: ".env.local" });

const DATA = path.resolve(process.cwd(), "data/met");
const LAUNCH = ["flower", "landscape", "animal"] as const;
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

  type ArtRow = {
    id: string;
    date_start: number | null;
    artist_title: string | null;
    is_public_domain: boolean;
    image_id: string | null;
    image_url: string | null;
    image_url_small: string | null;
  };
  type TermRow = {
    id: string;
    canonical: string;
    slug: string;
    aliases: string[] | null;
    status: TermMeta["status"];
  };

  const hasImage = (a: ArtRow) =>
    !!(a.image_url_small || a.image_url || a.image_id);

  const artworks = await fetchAll<ArtRow>(() =>
    supabase
      .from("artworks")
      .select(
        "id, date_start, artist_title, is_public_domain, image_id, image_url, image_url_small",
      )
      .eq("source", "met"),
  );
  const qualifying = new Set(
    artworks
      .filter((a) => a.is_public_domain && hasImage(a) && a.date_start != null)
      .map((a) => a.id),
  );
  const artById = new Map(artworks.map((a) => [a.id, a]));

  const terms = await fetchAll<TermRow>(() =>
    supabase.from("terms").select("id, canonical, slug, aliases, status"),
  );
  const termMeta: TermMeta[] = terms.map((t) => ({
    id: t.id,
    canonical: t.canonical,
    slug: t.slug,
    aliases: t.aliases ?? [],
    status: t.status,
  }));

  const links = await fetchAll<ArtworkTermLink>(() =>
    supabase
      .from("artwork_terms")
      .select("artwork_id, term_id, evidence_source")
      .in("evidence_source", ["term", "subject"]),
  );
  const qualifyingLinks = links.filter((l) => qualifying.has(l.artwork_id));

  const artworkTermSets = new Map<string, Set<string>>();
  for (const l of qualifyingLinks) {
    let set = artworkTermSets.get(l.artwork_id);
    if (!set) {
      set = new Set();
      artworkTermSets.set(l.artwork_id, set);
    }
    set.add(l.term_id);
  }

  const edges = computeConnections({
    terms: termMeta,
    artworkTermSets,
  });
  console.log(`connections=${edges.length}`);

  await supabase.from("term_connections").delete().gte("shared_work_count", 0);
  for (let i = 0; i < edges.length; i += 100) {
    const { error } = await supabase
      .from("term_connections")
      .upsert(edges.slice(i, i + 100));
    if (error) throw error;
  }

  await supabase.from("term_periods").delete().gte("period_index", -9999);
  let periodRows = 0;
  for (const t of termMeta.filter((x) => x.status === "journey_ready")) {
    const artIds = qualifyingLinks
      .filter((l) => l.term_id === t.id)
      .map((l) => l.artwork_id);
    const dated = artIds
      .map((id) => artById.get(id))
      .filter((a): a is ArtRow => !!a && a.date_start != null)
      .map((a) => ({
        id: a.id,
        date_start: a.date_start!,
        artist_title: a.artist_title,
      }));
    const periods = computeTermPeriods(t.id, dated);
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
    JSON.stringify({ edges: edges.length, periods: periodRows }, null, 2),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
