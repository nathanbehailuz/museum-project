import { Suspense } from "react";
import SubjectShell from "@/app/components/SubjectShell";
import styles from "@/app/components/museum.module.css";
import {
  getTermBySlug,
  mapTerm,
  suggestJourneyReady,
} from "@/lib/aic/queries";
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
        <p className={styles.error}>
          Could not reach the index. Try again shortly.
        </p>
      </main>
    );
  }

  if (!term) {
    const suggestions = (await suggestJourneyReady(6)).map(mapTerm);
    return (
      <main className={styles.page}>
        <h1 className={styles.subjectTitle}>Subject not found</h1>
        <p className={styles.muted}>
          No subject named “{slug}” in the index.
        </p>
        <SuggestionList suggestions={suggestions} />
      </main>
    );
  }

  if (term.status === "unavailable") {
    const suggestions = (await suggestJourneyReady(6)).map(mapTerm);
    const subject = mapTerm(term);
    return (
      <main className={styles.page}>
        <h1 className={styles.subjectTitle}>{subject.displayLabel}</h1>
        <p className={styles.muted}>
          {subject.validationReasons.join(" ") ||
            "Not enough displayable works for a subject page yet."}
        </p>
        <SuggestionList suggestions={suggestions} />
      </main>
    );
  }

  const subject = mapTerm(term);

  return (
    <Suspense
      fallback={
        <main className={styles.page}>
          <p className={styles.muted}>Loading…</p>
        </main>
      }
    >
      <SubjectShell subject={subject}>{children}</SubjectShell>
    </Suspense>
  );
}
