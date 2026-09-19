import ChronologyConstellation from "@/app/components/ChronologyConstellation";
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

export default async function JourneyPage({ params, searchParams }: Props) {
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
    const { data: periods, error } = await supabase
      .from("term_periods")
      .select(
        "period_index, label, begin_year, end_year, work_count, featured_artwork_ids",
      )
      .eq("term_id", term.id)
      .order("period_index", { ascending: true });
    if (error) throw error;

    const allFeaturedIds = [
      ...new Set(
        (periods ?? []).flatMap(
          (p) => (p.featured_artwork_ids as string[]) ?? [],
        ),
      ),
    ];
    const artworks = await getArtworksByIds(allFeaturedIds);
    const byId = new Map(artworks.map((a) => [a.id, a]));

    const chapters = (periods ?? []).map((p) => {
      const ids = (p.featured_artwork_ids as string[]) ?? [];
      return {
        periodIndex: p.period_index as number,
        label: p.label as string,
        beginYear: p.begin_year as number | null,
        endYear: p.end_year as number | null,
        workCount: p.work_count as number,
        featured: ids
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((row) => mapArtwork(row!)),
      };
    });

    return (
      <ChronologyConstellation
        chapters={chapters}
        activeChapter={state.chapter}
        subjectLabel={term.display_label}
        workCount={term.qualifying_work_count}
        dateMin={term.date_min}
        dateMax={term.date_max}
      />
    );
  } catch {
    return (
      <p className={styles.error}>
        Could not load journey chapters. The index may be temporarily
        unavailable.
      </p>
    );
  }
}
