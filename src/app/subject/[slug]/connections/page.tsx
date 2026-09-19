import ConnectionsView from "@/app/components/ConnectionsView";
import styles from "@/app/components/museum.module.css";
import {
  getArtworksByIds,
  getTermBySlug,
  mapArtwork,
} from "@/lib/aic/queries";
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
      .limit(8);
    if (error) throw error;

    const targetIds = (edges ?? []).map((e) => e.target_term_id as string);
    const { data: targets } = targetIds.length
      ? await supabase
          .from("terms")
          .select("id, slug, display_label, canonical")
          .in("id", targetIds)
      : {
          data: [] as {
            id: string;
            slug: string;
            display_label: string;
            canonical: string;
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

    const connections = (edges ?? []).map((e) => {
      const t = targetById.get(e.target_term_id as string);
      const ids = (e.sample_artwork_ids as string[]) ?? [];
      return {
        targetSlug: t?.slug ?? "",
        targetLabel: t?.display_label ?? t?.canonical ?? "",
        sharedWorkCount: e.shared_work_count as number,
        connectionScore: Number(e.connection_score),
        samples: ids
          .map((id) => sampleById.get(id))
          .filter(Boolean)
          .map((row) => mapArtwork(row!)),
      };
    });

    let intersection = [] as ReturnType<typeof mapArtwork>[];
    if (state.related) {
      const related = await getTermBySlug(state.related);
      if (related) {
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
            .in("evidence_source", ["subject", "term"]);
          const { data: b } = await supabase
            .from("artwork_terms")
            .select("artwork_id")
            .eq("term_id", related.id)
            .in("evidence_source", ["subject", "term"]);
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
