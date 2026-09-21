"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SubjectSummary } from "@/lib/aic/apiTypes";
import { formatSubjectMeta } from "@/lib/formatDate";
import { subjectPath } from "@/lib/subjectUrlState";
import styles from "./museum.module.css";

type Props = {
  initialQuery?: string;
  autofocus?: boolean;
  compact?: boolean;
};

export default function SubjectSearch({
  initialQuery = "",
  autofocus,
  compact = false,
}: Props) {
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [results, setResults] = useState<SubjectSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      fetch(`/api/subjects?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((json) => {
          setResults(json.results ?? []);
          setActiveIndex(-1);
          // Only open the list after the user is interacting with search.
          if (
            document.activeElement ===
            document.getElementById(
              compact ? "subject-search-compact" : "subject-search",
            )
          ) {
            setOpen(true);
          }
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(handle);
  }, [q, compact]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = useCallback(
    (subject: SubjectSummary) => {
      setOpen(false);
      router.push(subjectPath(subject.slug, "journey"));
    },
    [router],
  );

  return (
    <div
      className={compact ? styles.searchWrapCompact : styles.searchWrap}
      ref={wrapRef}
    >
      <label
        className={compact ? styles.searchLabelCompact : styles.searchLabel}
        htmlFor={compact ? "subject-search-compact" : "subject-search"}
      >
        Search the collection
      </label>
      {compact && (
        <svg
          className={styles.searchIcon}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            fill="currentColor"
            d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
          />
        </svg>
      )}
      <input
        id={compact ? "subject-search-compact" : "subject-search"}
        className={compact ? styles.searchInputCompact : styles.searchInput}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        placeholder={
          compact
            ? "Search motifs…"
            : "Try flower, landscape, animal…"
        }
        value={q}
        autoFocus={autofocus}
        onFocus={() => {
          if (results.length > 0) setOpen(true);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            return;
          }
          if (!open || !results.length) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % results.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
          } else if (e.key === "Enter" && activeIndex >= 0) {
            e.preventDefault();
            go(results[activeIndex]);
          }
        }}
      />
      {loading && (
        <span className={styles.srOnly} aria-live="polite">
          Searching
        </span>
      )}
      {open && results.length > 0 && (
        <ul id={listId} className={styles.suggestList} role="listbox">
          {results.map((s, i) => (
            <li
              key={s.slug}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={activeIndex === i}
            >
              <button
                type="button"
                className={styles.suggestItem}
                onClick={() => go(s)}
                onMouseEnter={() => setActiveIndex(i)}
              >
                <span className={styles.suggestTitle}>{s.displayLabel}</span>
                <span className={styles.suggestMeta}>
                  {formatSubjectMeta(
                    s.qualifyingWorkCount || s.catalogWorkCount,
                    s.dateMin,
                    s.dateMax,
                  )}
                  {s.status === "browse_only" ? " · browse only" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
