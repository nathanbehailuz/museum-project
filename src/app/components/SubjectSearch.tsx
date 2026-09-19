"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SubjectSummary } from "@/lib/aic/apiTypes";
import { subjectPath } from "@/lib/subjectUrlState";
import styles from "./museum.module.css";

type Props = {
  initialQuery?: string;
  autofocus?: boolean;
};

export default function SubjectSearch({ initialQuery = "", autofocus }: Props) {
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
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 220);
    return () => clearTimeout(handle);
  }, [q]);

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
      if (subject.status === "journey_ready") {
        router.push(subjectPath(subject.slug, "journey"));
      } else {
        router.push(subjectPath(subject.slug, "works"));
      }
    },
    [router],
  );

  return (
    <div className={styles.searchWrap} ref={wrapRef}>
      <label className={styles.searchLabel} htmlFor="subject-search">
        Search the collection
      </label>
      <input
        id="subject-search"
        className={styles.searchInput}
        type="search"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
        }
        placeholder="Try flower, landscape, animal…"
        value={q}
        autoFocus={autofocus}
        onChange={(e) => setQ(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
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
          } else if (e.key === "Escape") {
            setOpen(false);
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
                  {s.qualifyingWorkCount} works
                  {s.dateMin != null && s.dateMax != null
                    ? ` · ${s.dateMin}–${s.dateMax}`
                    : ""}
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
