import Link from "next/link";
import type { SubjectSummary } from "@/lib/aic/apiTypes";
import { subjectPath } from "@/lib/subjectUrlState";
import styles from "@/app/components/museum.module.css";

type Props = {
  suggestions: SubjectSummary[];
};

export function SuggestionList({ suggestions }: Props) {
  if (!suggestions.length) return null;
  return (
    <ul className={styles.connList}>
      {suggestions.map((s) => (
        <li key={s.slug}>
          <Link href={subjectPath(s.slug, "journey")}>
            {s.displayLabel} · {s.qualifyingWorkCount} works
          </Link>
        </li>
      ))}
    </ul>
  );
}
