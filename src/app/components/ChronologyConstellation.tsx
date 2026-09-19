"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { ArtworkCard, JourneyChapter } from "@/lib/aic/apiTypes";
import {
  formatDateDisplay,
  formatSubjectMeta,
  formatYear,
} from "@/lib/formatDate";
import ArtworkImage from "./ArtworkImage";
import { useOpenArtwork } from "./SubjectShell";
import styles from "./constellation.module.css";

const MAX_NODES = 16;
const MAX_PER_PERIOD = 3;
/** Approximate node footprint used for spacing (card + caption). */
const NODE_W = 150;
const NODE_H = 210;
const PAD_X = 96;
const PAD_Y = 110;

type Props = {
  chapters: JourneyChapter[];
  activeChapter: number | null;
  subjectLabel: string;
  workCount: number;
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

function hashUnit(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (Math.abs(h) % 1000) / 1000;
}

function pickWorks(
  chapters: JourneyChapter[],
  activeChapter: number | null,
): { work: ArtworkCard; periodLabel: string }[] {
  const filtered =
    activeChapter != null
      ? chapters.filter((c) => c.periodIndex === activeChapter)
      : chapters;

  const fromPeriods: { work: ArtworkCard; periodLabel: string }[] = [];
  const seen = new Set<string>();

  for (const ch of filtered) {
    let taken = 0;
    for (const work of ch.featured) {
      if (seen.has(work.sourceId)) continue;
      seen.add(work.sourceId);
      fromPeriods.push({ work, periodLabel: ch.label });
      taken += 1;
      if (taken >= MAX_PER_PERIOD || fromPeriods.length >= MAX_NODES) break;
    }
    if (fromPeriods.length >= MAX_NODES) break;
  }

  return fromPeriods
    .sort(
      (a, b) =>
        (a.work.dateStart ?? Number.POSITIVE_INFINITY) -
        (b.work.dateStart ?? Number.POSITIVE_INFINITY),
    )
    .slice(0, MAX_NODES);
}

/**
 * Spread chronologically ordered nodes across the full canvas.
 * Rank drives most of the X axis so tight date clusters still fan out;
 * date only nudges when the span is wide enough to matter.
 */
function layoutNodes(
  items: { work: ArtworkCard; periodLabel: string }[],
  size: Size,
): LaidOut[] {
  const n = items.length;
  if (!n) return [];

  const innerW = Math.max(size.w - PAD_X * 2, NODE_W);
  const innerH = Math.max(size.h - PAD_Y * 2, NODE_H);
  const minGapX = Math.max(NODE_W + 24, Math.min(220, innerW / Math.max(n, 1)));

  const dates = items
    .map((i) => i.work.dateStart)
    .filter((d): d is number => d != null);
  const minD = dates.length ? Math.min(...dates) : 0;
  const maxD = dates.length ? Math.max(...dates) : 0;
  const dateSpan = Math.max(maxD - minD, 0);
  // Years of spread per step — low means dates are bunched → lean on rank.
  const yearsPerStep = n > 1 ? dateSpan / (n - 1) : dateSpan;
  const rankWeight =
    dateSpan < 25 || yearsPerStep < 12 ? 0.92 : yearsPerStep < 25 ? 0.7 : 0.45;

  const placed: LaidOut[] = items.map((item, i) => {
    const tRank = n === 1 ? 0.5 : i / (n - 1);
    const tDate =
      item.work.dateStart != null && dateSpan > 0
        ? (item.work.dateStart - minD) / dateSpan
        : tRank;
    const t = tRank * rankWeight + tDate * (1 - rankWeight);
    const x = PAD_X + t * innerW;

    // Diagonal wave: alternate bands so the path reads like image 3.
    const band = i % 2 === 0 ? -1 : 1;
    const amplitude = Math.min(innerH * 0.32, 130 + n * 4);
    const drift = (hashUnit(item.work.sourceId) - 0.5) * 36;
    const y = size.h / 2 + band * amplitude * (0.55 + (i % 3) * 0.12) + drift;

    return { ...item, x, y };
  });

  // Enforce horizontal separation left→right (preserves chronological order).
  for (let i = 1; i < placed.length; i++) {
    const minX = placed[i - 1].x + minGapX;
    if (placed[i].x < minX) placed[i].x = minX;
  }
  // If we overflow the right pad, compress evenly across full width by rank.
  const last = placed[placed.length - 1];
  if (last && last.x > size.w - PAD_X) {
    for (let i = 0; i < placed.length; i++) {
      const t = n === 1 ? 0.5 : i / (n - 1);
      placed[i].x = PAD_X + t * innerW;
    }
  }

  // Resolve vertical overlaps when nodes share a similar x.
  for (let pass = 0; pass < 4; pass++) {
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = placed[i];
        const b = placed[j];
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        if (dx < NODE_W * 0.85 && dy < NODE_H * 0.75) {
          const push = (NODE_H * 0.75 - dy) / 2 + 8;
          if (a.y <= b.y) {
            a.y = Math.max(PAD_Y, a.y - push);
            b.y = Math.min(size.h - PAD_Y, b.y + push);
          } else {
            b.y = Math.max(PAD_Y, b.y - push);
            a.y = Math.min(size.h - PAD_Y, a.y + push);
          }
        }
      }
    }
  }

  for (const p of placed) {
    p.y = Math.min(size.h - PAD_Y, Math.max(PAD_Y, p.y));
    p.x = Math.min(size.w - PAD_X, Math.max(PAD_X, p.x));
  }

  return placed;
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
  subjectLabel,
  workCount,
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

  const nodes = useMemo(
    () => layoutNodes(pickWorks(chapters, activeChapter), size),
    [chapters, activeChapter, size],
  );

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

  const spanLabel = formatSubjectMeta(workCount, dateMin, dateMax);

  if (!pickWorks(chapters, activeChapter).length) {
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
            width: size.w,
            height: size.h,
            transform: `scale(${zoom})`,
          }}
        >
          <svg
            className={styles.svgLayer}
            viewBox={`0 0 ${size.w} ${size.h}`}
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
        >
          +
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => setZoom((z) => Math.max(0.55, z - 0.15))}
          title="Zoom out"
        >
          −
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          onClick={() => setZoom(1)}
          title="Reset zoom"
        >
          ⊙
        </button>
      </div>
    </div>
  );
}
