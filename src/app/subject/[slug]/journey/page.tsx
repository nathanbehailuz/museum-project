import ChronologyConstellation from "@/app/components/ChronologyConstellation";
import styles from "@/app/components/museum.module.css";
import { getJourneyWorksPage } from "@/lib/aic/journeyWorks";
import { getTermBySlug } from "@/lib/aic/queries";
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
        "period_index, label, begin_year, end_year, work_count",
      )
      .eq("term_id", term.id)
      .order("period_index", { ascending: true });
    if (error) throw error;

    const chapters = (periods ?? []).map((p) => {
      return {
        periodIndex: p.period_index as number,
        label: p.label as string,
        beginYear: p.begin_year as number | null,
        endYear: p.end_year as number | null,
        workCount: p.work_count as number,
        featured: [],
      };
    });
    const activePeriod =
      state.chapter == null
        ? null
        : chapters.find(
            (chapter) => chapter.periodIndex === state.chapter,
          ) ?? null;
    const initialFeed = await getJourneyWorksPage({
      termId: term.id,
      slug,
      catalogCount: term.catalog_work_count ?? 0,
      page: 1,
      pageSize: 5000,
      fromYear: activePeriod?.beginYear,
      toYear: activePeriod?.endYear,
    });

    return (
      <ChronologyConstellation
        chapters={chapters}
        activeChapter={state.chapter}
        subjectSlug={slug}
        subjectLabel={term.display_label}
        initialFeed={initialFeed}
        dateMin={activePeriod?.beginYear ?? term.date_min}
        dateMax={activePeriod?.endYear ?? term.date_max}
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
