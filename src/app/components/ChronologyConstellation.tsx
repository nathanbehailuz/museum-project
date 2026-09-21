"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type {
  ArtworkCard,
  JourneyChapter,
  JourneyWorksResponse,
} from "@/lib/aic/apiTypes";
import {
  formatDateDisplay,
  formatSubjectMeta,
  formatYear,
} from "@/lib/formatDate";
import ArtworkImage from "./ArtworkImage";
import { useOpenArtwork } from "./SubjectShell";
import styles from "./constellation.module.css";

/** Approximate node footprint used for spacing (card + caption). */
const NODE_W = 150;
const NODE_H = 210;
const MIN_GAP_X = NODE_W + 24;
const PAD_X = 96;
const PAD_Y = 110;

type Props = {
  chapters: JourneyChapter[];
  activeChapter: number | null;
  subjectSlug: string;
  subjectLabel: string;
  initialFeed: JourneyWorksResponse;
  dateMin: number | null;
  dateMax: number | null;
};

type LaidOut = {
  work: ArtworkCard;
  x: number;
  y: number;
  periodLabel: string;
};

type Size = { w: number; h: number };
type Layout = { nodes: LaidOut[]; width: number };

function hashUnit(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000) / 1000;
}

function chronologicalWorks(works: ArtworkCard[]): ArtworkCard[] {
  const seen = new Set<string>();
  return works
    .filter((work) => {
      if (seen.has(work.sourceId)) return false;
      seen.add(work.sourceId);
      return true;
    })
    .sort(
      (a, b) =>
        (a.dateStart ?? Number.POSITIVE_INFINITY) -
          (b.dateStart ?? Number.POSITIVE_INFINITY) ||
        a.sourceId.localeCompare(b.sourceId),
    );
}

function periodLabelFor(work: ArtworkCard, chapters: JourneyChapter[]): string {
  if (work.dateStart == null) return "";
  return (
    chapters.find(
      (chapter) =>
        chapter.beginYear != null &&
        chapter.endYear != null &&
        work.dateStart! >= chapter.beginYear &&
        work.dateStart! <= chapter.endYear,
    )?.label ?? ""
  );
}

/**
 * Spread chronologically ordered nodes across the full canvas.
 * Rank drives most of the X axis so tight date clusters still fan out;
 * date only nudges when the span is wide enough to matter.
 */
function layoutNodes(
  items: { work: ArtworkCard; periodLabel: string }[],
  size: Size,
): Layout {
  const n = items.length;
  if (!n) return { nodes: [], width: size.w };

  const contentWidth = Math.max(
    size.w,
    PAD_X * 2 + Math.max(0, n - 1) * MIN_GAP_X,
  );
  const innerH = Math.max(size.h - PAD_Y * 2, NODE_H);

  const placed: LaidOut[] = items.map((item, i) => {
    const x = n === 1 ? contentWidth / 2 : PAD_X + i * MIN_GAP_X;

    // Diagonal wave: alternate bands so the path reads like image 3.
    const band = i % 2 === 0 ? -1 : 1;
    const amplitude = Math.min(innerH * 0.32, 130 + n * 4);
    const drift = (hashUnit(item.work.sourceId) - 0.5) * 36;
    const y = size.h / 2 + band * amplitude * (0.55 + (i % 3) * 0.12) + drift;

    return { ...item, x, y };
  });

  for (const p of placed) {
    p.y = Math.min(size.h - PAD_Y, Math.max(PAD_Y, p.y));
  }

  return { nodes: placed, width: contentWidth };
}

function curvePath(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  i: number,
): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + (i % 2 === 0 ? -48 : 48);
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

function dateBadge(work: ArtworkCard, periodLabel: string): string {
  if (work.dateStart != null) return formatYear(work.dateStart);
  const cleaned = formatDateDisplay(work.dateDisplay);
  if (cleaned) return cleaned.slice(0, 14);
  return periodLabel.slice(0, 12);
}

export default function ChronologyConstellation({
  chapters,
  activeChapter,
  subjectSlug,
  subjectLabel,
  initialFeed,
  dateMin,
  dateMax,
}: Props) {
  const open = useOpenArtwork();
  const searchParams = useSearchParams();
  const focusedId = searchParams.get("artwork");
  const [zoom, setZoom] = useState(1);
  const nodeRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const fieldRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size>({ w: 1100, h: 560 });
  const [cachedWorks, setCachedWorks] = useState(() =>
    chronologicalWorks(initialFeed.works),
  );
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageRetry, setPageRetry] = useState(0);
  const activePeriod =
    activeChapter == null
      ? null
      : chapters.find((chapter) => chapter.periodIndex === activeChapter) ??
        null;
  const fromYear = activePeriod?.beginYear ?? null;
  const toYear = activePeriod?.endYear ?? null;

  useEffect(() => {
    const el = fieldRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({
        w: Math.max(640, Math.floor(r.width)),
        h: Math.max(420, Math.floor(r.height)),
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const firstPage = chronologicalWorks(initialFeed.works);
    setCachedWorks(firstPage);
    setLoadError(null);

    const totalPages = Math.ceil(initialFeed.total / initialFeed.pageSize);
    if (totalPages <= 1) {
      setLoadingMore(false);
      return () => controller.abort();
    }

    const loadRemainingCachedWorks = async () => {
      setLoadingMore(true);
      const allWorks = [...firstPage];
      const concurrency = 4;

      for (let first = 2; first <= totalPages; first += concurrency) {
        const pages = Array.from(
          { length: Math.min(concurrency, totalPages - first + 1) },
          (_, index) => first + index,
        );
        const responses = await Promise.all(
          pages.map(async (page) => {
            const params = new URLSearchParams({
              page: String(page),
              pageSize: String(initialFeed.pageSize),
            });
            if (fromYear != null) params.set("from", String(fromYear));
            if (toYear != null) params.set("to", String(toYear));
            const response = await fetch(
              `/api/subjects/${encodeURIComponent(subjectSlug)}/journey/works?${params}`,
              { signal: controller.signal },
            );
            if (!response.ok) throw new Error("Could not load more works");
            return (await response.json()) as JourneyWorksResponse;
          }),
        );
        for (const response of responses) allWorks.push(...response.works);
      }

      if (!controller.signal.aborted) {
        setCachedWorks(chronologicalWorks(allWorks));
        setLoadingMore(false);
      }
    };

    void loadRemainingCachedWorks().catch((error: unknown) => {
      if (
        error instanceof DOMException && error.name === "AbortError"
      ) {
        return;
      }
      if (!controller.signal.aborted) {
        setLoadingMore(false);
        setLoadError(
          error instanceof Error ? error.message : "Could not load more works",
        );
      }
    });

    return () => controller.abort();
  }, [fromYear, initialFeed, pageRetry, subjectSlug, toYear]);

  const works = useMemo(
    () =>
      cachedWorks.map((work) => ({
        work,
        periodLabel: periodLabelFor(work, chapters),
      })),
    [cachedWorks, chapters],
  );
  const layout = useMemo(() => layoutNodes(works, size), [works, size]);
  const { nodes } = layout;

  useEffect(() => {
    if (!focusedId) return;
    nodeRefs.current.get(focusedId)?.scrollIntoView({
      block: "nearest",
      inline: "center",
    });
  }, [focusedId, nodes]);

  const edges = useMemo(() => {
    const out: { d: string; key: string }[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i];
      const b = nodes[i + 1];
      out.push({
        d: curvePath(a.x, a.y, b.x, b.y, i),
        key: `${a.work.sourceId}-${b.work.sourceId}`,
      });
    }
    return out;
  }, [nodes]);

  const spanLabel = formatSubjectMeta(initialFeed.total, dateMin, dateMax);

  if (!works.length) {
    return (
      <div className={styles.canvasWrap}>
        <p className={styles.empty}>
          No dated works plotted for this subject yet.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.canvasWrap}>
      <div className={styles.ambient} aria-hidden="true">
        <div className={styles.ambientGlowA} />
        <div className={styles.ambientGlowB} />
        <div className={styles.dotGrid} />
      </div>

      <div className={styles.banner}>
        <div className={styles.bannerMeta}>
          <div className={styles.stamp}>
            <span className={styles.stampValue}>
              {subjectLabel} across time
            </span>
          </div>
          <span className={styles.statChip}>{spanLabel}</span>
          <span className={styles.catalogChip}>
            Catalog subject · decorative motif &amp; depiction
          </span>
        </div>
      </div>

      <div className={styles.field} ref={fieldRef}>
        <div
          className={styles.scaled}
          style={{
            width: layout.width,
            height: size.h,
            transform: `scale(${zoom})`,
          }}
        >
          <svg
            className={styles.svgLayer}
            viewBox={`0 0 ${layout.width} ${size.h}`}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="edgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f2ca50" stopOpacity="0.85" />
                <stop offset="100%" stopColor="#ffb691" stopOpacity="0.55" />
              </linearGradient>
            </defs>
            {edges.map((e, i) => (
              <path
                key={e.key}
                d={e.d}
                className={i % 3 === 0 ? styles.edgePathFaint : styles.edgePath}
              />
            ))}
          </svg>

          {nodes.map((n) => {
            const focused = focusedId === n.work.sourceId;
            return (
              <button
                key={n.work.sourceId}
                type="button"
                ref={(el) => {
                  if (el) nodeRefs.current.set(n.work.sourceId, el);
                  else nodeRefs.current.delete(n.work.sourceId);
                }}
                className={`${styles.node} ${focused ? styles.nodeFocused : ""}`}
                style={{ left: n.x, top: n.y }}
                onClick={() =>
                  open(
                    n.work.sourceId,
                    nodeRefs.current.get(n.work.sourceId) ?? null,
                  )
                }
              >
                <div className={styles.nodeCard}>
                  {focused && (
                    <span className={styles.focusBadge}>Inspection focus</span>
                  )}
                  <div className={styles.nodeThumb}>
                    <ArtworkImage
                      src={n.work.imageUrl}
                      alt={n.work.altText || n.work.title || "Artwork"}
                      width={n.work.imageWidth}
                      height={n.work.imageHeight}
                    />
                    <span className={styles.dateBadge}>
                      {dateBadge(n.work, n.periodLabel)}
                    </span>
                  </div>
                </div>
                <span className={styles.nodeTitle}>
                  {n.work.title || "Untitled"}
                </span>
                <span className={styles.nodeMeta}>
                  {[
                    formatDateDisplay(n.work.dateDisplay) ||
                      (n.work.dateStart != null
                        ? formatYear(n.work.dateStart)
                        : null),
                    n.work.mediumDisplay || n.work.artistTitle,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.tools} aria-label="Canvas zoom">
        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}
          title="Zoom in"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => setZoom((z) => Math.max(0.55, z - 0.15))}
          title="Zoom out"
          aria-label="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => setZoom(1)}
          title="Reset zoom"
          aria-label="Reset zoom"
        >
          ⊙
        </button>
      </div>

      {(loadingMore || loadError) && (
        <div className={styles.feedStatus} aria-live="polite">
          {loadingMore && (
            <span className={styles.feedChip}>Loading more works…</span>
          )}
          {loadError && (
            <>
              <span className={styles.feedError}>{loadError}</span>
              <button
                type="button"
                className={styles.feedRetry}
                onClick={() => setPageRetry((n) => n + 1)}
              >
                Retry
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
