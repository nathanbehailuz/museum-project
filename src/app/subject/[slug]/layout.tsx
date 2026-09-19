import { Suspense } from "react";
import SubjectShell from "@/app/components/SubjectShell";
import styles from "@/app/components/museum.module.css";
import {
  getTermBySlug,
  mapTerm,
  suggestJourneyReady,
} from "@/lib/aic/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SuggestionList } from "./helpers";

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

  if (term.status === "unavailable") {
    const suggestions = (await suggestJourneyReady(6)).map(mapTerm);
    const subject = mapTerm(term);
    return (
      <main className={styles.page}>
        <div className={styles.pageInner}>
          <h1 className={styles.subjectTitle}>{subject.displayLabel}</h1>
          <p className={styles.muted}>
            {subject.validationReasons.join(" ") ||
              "Not enough displayable works for a subject page yet."}
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
    <Suspense
      fallback={
        <main className={styles.page}>
          <div className={styles.pageInner}>
            <p className={styles.muted}>Loading…</p>
          </div>
        </main>
      }
    >
      <SubjectShell subject={subject} epochs={epochs}>
        {children}
      </SubjectShell>
    </Suspense>
  );
}
