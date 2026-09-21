import Link from "next/link";
import type { SubjectSummary } from "@/lib/aic/apiTypes";
import { formatSubjectMeta } from "@/lib/formatDate";
import { subjectPath } from "@/lib/subjectUrlState";
import styles from "@/app/components/museum.module.css";

type Props = {
  suggestions: SubjectSummary[];
};

export function SuggestionList({ suggestions }: Props) {
  if (!suggestions.length) return null;
  return (
    <ul className={styles.suggestionList}>
      {suggestions.map((s) => (
        <li key={s.slug}>
          <Link href={subjectPath(s.slug, "journey")}>
            {s.displayLabel} ·{" "}
            {formatSubjectMeta(
              s.qualifyingWorkCount || s.catalogWorkCount,
              s.dateMin,
              s.dateMax,
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
