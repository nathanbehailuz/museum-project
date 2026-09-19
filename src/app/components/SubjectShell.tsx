"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SubjectSummary } from "@/lib/aic/apiTypes";
import { subjectPath, type SubjectView } from "@/lib/subjectUrlState";
import SubjectInspection from "./SubjectInspection";
import SubjectSearch from "./SubjectSearch";
import styles from "./museum.module.css";

export const SubjectOpenContext = createContext<
  ((sourceId: string, el?: HTMLElement | null) => void) | null
>(null);

export function useOpenArtwork() {
  const ctx = useContext(SubjectOpenContext);
  if (!ctx) {
    throw new Error("useOpenArtwork must be used within SubjectShell");
  }
  return ctx;
}

type Props = {
  subject: SubjectSummary;
  children: React.ReactNode;
};

export default function SubjectShell({ subject, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const artwork = searchParams.get("artwork");
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const view: SubjectView = pathname.includes("/connections")
    ? "connections"
    : pathname.includes("/works")
      ? "works"
      : "journey";

  const closeInspection = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("artwork");
    const q = params.toString();
    router.push(`${pathname}${q ? `?${q}` : ""}`, { scroll: false });
  }, [pathname, router, searchParams]);

  const openArtwork = useCallback(
    (sourceId: string, el?: HTMLElement | null) => {
      if (el) returnFocusRef.current = el;
      const params = new URLSearchParams(searchParams.toString());
      params.set("artwork", sourceId);
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const share = useCallback(async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: subject.displayLabel, url });
      } else {
        await navigator.clipboard.writeText(url);
        alert("Link copied");
      }
    } catch {
      /* user cancelled */
    }
  }, [subject.displayLabel]);

  return (
    <div className={styles.page}>
      <SubjectSearch />
      <header className={styles.headerBar}>
        <div>
          <h1 className={styles.subjectTitle}>{subject.displayLabel}</h1>
          <p className={styles.subjectMeta}>
            {subject.qualifyingWorkCount} works
            {subject.dateMin != null && subject.dateMax != null
              ? ` · ${subject.dateMin}–${subject.dateMax}`
              : ""}
            {subject.status === "browse_only" ? " · browse only" : ""}
          </p>
        </div>
        <div className={styles.actions}>
          <nav className={styles.switcher} aria-label="Subject views">
            {subject.status === "journey_ready" && (
              <Link
                href={subjectPath(subject.slug, "journey")}
                aria-current={view === "journey" ? "page" : undefined}
              >
                Journey
              </Link>
            )}
            <Link
              href={subjectPath(subject.slug, "works")}
              aria-current={view === "works" ? "page" : undefined}
            >
              All Works
            </Link>
            <Link
              href={subjectPath(subject.slug, "connections")}
              aria-current={view === "connections" ? "page" : undefined}
            >
              Connections
            </Link>
          </nav>
          <button type="button" className={styles.button} onClick={share}>
            Share
          </button>
        </div>
      </header>
      <SubjectOpenContext.Provider value={openArtwork}>
        {children}
      </SubjectOpenContext.Provider>
      {artwork && (
        <SubjectInspection
          sourceId={artwork}
          onClose={closeInspection}
          returnFocusRef={returnFocusRef}
        />
      )}
    </div>
  );
}
