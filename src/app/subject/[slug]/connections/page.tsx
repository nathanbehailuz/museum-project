import ConnectionsView from "@/app/components/ConnectionsView";
import styles from "@/app/components/museum.module.css";
import {
  getArtworksByIds,
  getTermBySlug,
  isExplorableTerm,
  mapArtwork,
} from "@/lib/aic/queries";
import { enrichSubjectOnce } from "@/lib/index/enrichOnce";
import { CATALOG_EVIDENCE } from "@/lib/index/enrichIds";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseSubjectSearchParams } from "@/lib/subjectUrlState";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ConnectionsPage({
  params,
  searchParams,
}: Props) {
  const { slug } = await params;
  await enrichSubjectOnce(slug);
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const state = parseSubjectSearchParams(qs);

  const term = await getTermBySlug(slug);
  if (!term) {
    return <p className={styles.error}>Subject not found.</p>;
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data: edges, error } = await supabase
      .from("term_connections")
      .select(
        "target_term_id, shared_work_count, connection_score, sample_artwork_ids",
      )
      .eq("source_term_id", term.id)
      .order("connection_score", { ascending: false })
      .limit(32);
    if (error) throw error;

    const targetIds = (edges ?? []).map((e) => e.target_term_id as string);
    const { data: targets } = targetIds.length
      ? await supabase
          .from("terms")
          .select(
            "id, slug, display_label, canonical, status, qualifying_work_count",
          )
          .in("id", targetIds)
          .eq("status", "journey_ready")
          .gt("qualifying_work_count", 0)
      : {
          data: [] as {
            id: string;
            slug: string;
            display_label: string;
            canonical: string;
            status: string;
            qualifying_work_count: number;
          }[],
        };

    const targetById = new Map((targets ?? []).map((t) => [t.id, t]));
    const allSampleIds = [
      ...new Set(
        (edges ?? []).flatMap(
          (e) => (e.sample_artwork_ids as string[]) ?? [],
        ),
      ),
    ];
    const samples = await getArtworksByIds(allSampleIds);
    const sampleById = new Map(samples.map((a) => [a.id, a]));

    const { data: hubPeriods } = await supabase
      .from("term_periods")
      .select("featured_artwork_ids")
      .eq("term_id", term.id)
      .order("period_index", { ascending: true })
      .limit(4);
    const hubIds = [
      ...new Set(
        (hubPeriods ?? []).flatMap(
          (p) => (p.featured_artwork_ids as string[]) ?? [],
        ),
      ),
    ].slice(0, 1);
    const hubRows = await getArtworksByIds(hubIds);
    const hubSample = hubRows[0] ? mapArtwork(hubRows[0]) : null;

    const connections = (edges ?? [])
      .flatMap((e) => {
        const t = targetById.get(e.target_term_id as string);
        if (!t) return [];
        const ids = (e.sample_artwork_ids as string[]) ?? [];
        return [
          {
            targetSlug: t.slug,
            targetLabel: t.display_label ?? t.canonical ?? "",
            sharedWorkCount: e.shared_work_count as number,
            connectionScore: Number(e.connection_score),
            samples: ids
              .map((id) => sampleById.get(id))
              .filter(Boolean)
              .map((row) => mapArtwork(row!)),
          },
        ];
      })
      .slice(0, 8);

    let intersection = [] as ReturnType<typeof mapArtwork>[];
    if (state.related) {
      const related = await getTermBySlug(state.related);
      if (related && isExplorableTerm(related)) {
        const edge = (edges ?? []).find(
          (e) => e.target_term_id === related.id,
        );
        if (edge) {
          const ids = (edge.sample_artwork_ids as string[]) ?? [];
          intersection = ids
            .map((id) => sampleById.get(id))
            .filter(Boolean)
            .map((row) => mapArtwork(row!));
        } else {
          const { data: a } = await supabase
            .from("artwork_terms")
            .select("artwork_id")
            .eq("term_id", term.id)
            .in("evidence_source", [...CATALOG_EVIDENCE]);
          const { data: b } = await supabase
            .from("artwork_terms")
            .select("artwork_id")
            .eq("term_id", related.id)
            .in("evidence_source", [...CATALOG_EVIDENCE]);
          const setB = new Set((b ?? []).map((r) => r.artwork_id as string));
          const shared = [
            ...new Set((a ?? []).map((r) => r.artwork_id as string)),
          ]
            .filter((id) => setB.has(id))
            .slice(0, 12);
          const rows = await getArtworksByIds(shared);
          intersection = rows.map((r) => mapArtwork(r));
        }
      }
    }

    return (
      <ConnectionsView
        subjectSlug={term.slug}
        subjectLabel={term.display_label}
        hubSample={hubSample}
        connections={connections}
        related={state.related}
        intersection={intersection}
        note="Terms are connected through shared museum catalog metadata, not computer vision."
      />
    );
  } catch {
    return (
      <p className={styles.error}>
        Could not load connections. The index may be temporarily unavailable.
      </p>
    );
  }
}
