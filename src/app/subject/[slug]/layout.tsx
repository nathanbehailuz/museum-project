import { Suspense } from "react";
import { SubjectShellSkeleton } from "@/app/components/MuseumSkeletons";
import SubjectShell from "@/app/components/SubjectShell";
import styles from "@/app/components/museum.module.css";
import {
  getTermBySlug,
  isExplorableTerm,
  mapTerm,
  suggestJourneyReady,
} from "@/lib/aic/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SuggestionList } from "./helpers";

export const maxDuration = 60;

type Props = {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
};

export default async function SubjectLayout({ children, params }: Props) {
  const { slug } = await params;

  let term;
  try {
    term = await getTermBySlug(slug);
  } catch {
    return (
      <main className={styles.page}>
        <div className={styles.pageInner}>
          <p className={styles.error}>
            Could not reach the index. Try again shortly.
          </p>
        </div>
      </main>
    );
  }

  if (!term) {
    const suggestions = (await suggestJourneyReady(6)).map(mapTerm);
    return (
      <main className={styles.page}>
        <div className={styles.pageInner}>
          <h1 className={styles.subjectTitle}>Subject not found</h1>
          <p className={styles.muted}>
            No subject named “{slug}” in the index.
          </p>
          <SuggestionList suggestions={suggestions} />
        </div>
      </main>
    );
  }

  // Keep uncached / browse_only terms in the DB; do not open an empty journey for them.
  if (!isExplorableTerm(term)) {
    const suggestions = (await suggestJourneyReady(6)).map(mapTerm);
    const subject = mapTerm(term);
    return (
      <main className={styles.page}>
        <div className={styles.pageInner}>
          <h1 className={styles.subjectTitle}>{subject.displayLabel}</h1>
          <p className={styles.muted}>
            This subject is not ready to explore yet — we have not cached enough
            dated works. Try one of these instead.
          </p>
          <SuggestionList suggestions={suggestions} />
        </div>
      </main>
    );
  }

  const subject = mapTerm(term);

  let epochs: {
    periodIndex: number;
    label: string;
    beginYear: number | null;
    endYear: number | null;
  }[] = [];

  try {
    const supabase = createSupabaseServerClient();
    const { data: periods } = await supabase
      .from("term_periods")
      .select("period_index, label, begin_year, end_year")
      .eq("term_id", term.id)
      .order("period_index", { ascending: true });
    epochs = (periods ?? []).map((p) => ({
      periodIndex: p.period_index as number,
      label: p.label as string,
      beginYear: p.begin_year as number | null,
      endYear: p.end_year as number | null,
    }));
  } catch {
    epochs = [];
  }

  return (
    <Suspense fallback={<SubjectShellSkeleton />}>
      <SubjectShell subject={subject} epochs={epochs}>
        {children}
      </SubjectShell>
    </Suspense>
  );
}
