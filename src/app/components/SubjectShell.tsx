"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
} from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { JourneyChapter, SubjectSummary } from "@/lib/aic/apiTypes";
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
  epochs?: Pick<
    JourneyChapter,
    "periodIndex" | "label" | "beginYear" | "endYear"
  >[];
  children: React.ReactNode;
};

function formatYearSpan(min: number | null, max: number | null): string {
  if (min == null || max == null) return "";
  return `${min}–${max}`;
}

export default function SubjectShell({ subject, epochs = [], children }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const artwork = searchParams.get("artwork");
  const chapterRaw = searchParams.get("chapter");
  const activeChapter =
    chapterRaw != null && chapterRaw !== ""
      ? Number.parseInt(chapterRaw, 10)
      : null;
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const view: SubjectView = pathname.includes("/connections")
    ? "connections"
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
      /* cancelled */
    }
  }, [subject.displayLabel]);

  const span = formatYearSpan(subject.dateMin, subject.dateMax);
  const showEpochs = view === "journey" && epochs.length > 0;

  return (
    <div className={styles.shell}>
      <header className={styles.shellHeader}>
        <div className={styles.shellHeaderInner}>
          <div className={styles.shellTopRow}>
            <div className={styles.shellBrandBlock}>
              <p className={styles.shellBrand}>The Met Archive</p>
            </div>

            <nav className={styles.shellNav} aria-label="Subject views">
              <Link
                href={subjectPath(subject.slug, "journey")}
                className={styles.shellNavLink}
                aria-current={view === "journey" ? "page" : undefined}
              >
                Chronological Journey
              </Link>
              <Link
                href={subjectPath(subject.slug, "connections")}
                className={styles.shellNavLink}
                aria-current={view === "connections" ? "page" : undefined}
              >
                Object Connections Graph
              </Link>
            </nav>

            <div className={styles.shellActions}>
              <SubjectSearch compact />
              <button type="button" className={styles.button} onClick={share}>
                Share
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.shellMain}>
        <SubjectOpenContext.Provider value={openArtwork}>
          {children}
        </SubjectOpenContext.Provider>
      </div>

      {showEpochs && (
        <footer className={styles.epochFooter} aria-label="Epochs">
          <div className={styles.epochStrip}>
            <span className={styles.epochLabel}>
              Epochs
              {span ? ` (${span})` : ""}
            </span>
            <Link
              href={subjectPath(subject.slug, "journey")}
              className={styles.epochBtn}
              aria-current={
                activeChapter == null || Number.isNaN(activeChapter)
                  ? "page"
                  : undefined
              }
            >
              All
            </Link>
            {epochs.map((ep) => (
              <Link
                key={ep.periodIndex}
                href={subjectPath(subject.slug, "journey", {
                  chapter: ep.periodIndex,
                })}
                className={styles.epochBtn}
                aria-current={
                  activeChapter === ep.periodIndex ? "page" : undefined
                }
              >
                {ep.beginYear != null && ep.endYear != null
                  ? `${ep.beginYear} – ${ep.endYear}`
                  : ep.label}
              </Link>
            ))}
          </div>
        </footer>
      )}

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
