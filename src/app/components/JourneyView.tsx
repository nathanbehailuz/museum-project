"use client";

import { useEffect, useRef } from "react";
import type { ArtworkCard, JourneyChapter } from "@/lib/aic/apiTypes";
import ArtworkImage from "./ArtworkImage";
import { useOpenArtwork } from "./SubjectShell";
import styles from "./museum.module.css";

type Props = {
  chapters: JourneyChapter[];
  activeChapter: number | null;
};

function WorkThumb({ work }: { work: ArtworkCard }) {
  const open = useOpenArtwork();
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={btnRef}
      type="button"
      className={styles.workButton}
      onClick={() => open(work.sourceId, btnRef.current)}
    >
      <ArtworkImage
        src={work.imageUrl}
        alt={work.altText || work.title || "Artwork"}
        width={work.imageWidth}
        height={work.imageHeight}
      />
      <div className={styles.workCaption}>
        <strong>{work.title || "Untitled"}</strong>
        <span>
          {work.artistTitle || "Artist unknown"}
          {work.dateDisplay ? ` · ${work.dateDisplay}` : ""}
        </span>
      </div>
    </button>
  );
}

export default function JourneyView({ chapters, activeChapter }: Props) {
  const refs = useRef<Map<number, HTMLElement>>(new Map());

  useEffect(() => {
    if (activeChapter == null) return;
    const el = refs.current.get(activeChapter);
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el?.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    });
  }, [activeChapter]);

  if (!chapters.length) {
    return (
      <p className={styles.muted}>
        No journey chapters yet for this subject.
      </p>
    );
  }

  return (
    <div className={styles.journey}>
      {chapters.map((ch) => (
        <section
          key={ch.periodIndex}
          className={`${styles.chapter} ${styles.chapterEnter}`}
          aria-labelledby={`chapter-${ch.periodIndex}`}
          ref={(node) => {
            if (node) refs.current.set(ch.periodIndex, node);
            else refs.current.delete(ch.periodIndex);
          }}
        >
          <h2
            id={`chapter-${ch.periodIndex}`}
            className={styles.chapterLabel}
          >
            {ch.label}
          </h2>
          <p className={styles.chapterMeta}>
            {ch.beginYear != null && ch.endYear != null
              ? `${ch.beginYear}–${ch.endYear}`
              : ""}
            {ch.workCount ? ` · ${ch.workCount} works in this period` : ""}
          </p>
          <div className={styles.chapterWorks}>
            {ch.featured.map((work) => (
              <WorkThumb key={work.sourceId} work={work} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
