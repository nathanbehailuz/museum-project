"use client";

import { useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ArtworkCard, ConnectionEdgeCard } from "@/lib/aic/apiTypes";
import { subjectPath } from "@/lib/subjectUrlState";
import ArtworkImage from "./ArtworkImage";
import { useOpenArtwork } from "./SubjectShell";
import styles from "./constellation.module.css";
import museum from "./museum.module.css";

type Props = {
  subjectSlug: string;
  subjectLabel: string;
  connections: ConnectionEdgeCard[];
  related: string | null;
  intersection: ArtworkCard[];
  note: string;
};

const CX = 50;
const CY = 50;
const RADIUS = 38;

export default function ConnectionsView({
  subjectSlug,
  subjectLabel,
  connections,
  related,
  intersection,
  note,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const open = useOpenArtwork();

  const selectRelated = useCallback(
    (slug: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (related === slug) params.delete("related");
      else params.set("related", slug);
      params.delete("artwork");
      const q = params.toString();
      router.push(`${pathname}${q ? `?${q}` : ""}`);
    },
    [pathname, related, router, searchParams],
  );

  const radial = useMemo(() => connections.slice(0, 8), [connections]);

  const positions = useMemo(() => {
    return radial.map((c, i) => {
      const angle =
        (i / Math.max(radial.length, 1)) * Math.PI * 2 - Math.PI / 2;
      return {
        ...c,
        left: CX + RADIUS * Math.cos(angle),
        top: CY + RADIUS * Math.sin(angle),
        midLeft: CX + RADIUS * 0.55 * Math.cos(angle),
        midTop: CY + RADIUS * 0.55 * Math.sin(angle),
      };
    });
  }, [radial]);

  const active =
    connections.find((c) => c.targetSlug === related) ?? connections[0];
  const strip =
    related && intersection.length
      ? intersection
      : (active?.samples ?? []);

  if (!connections.length) {
    return (
      <div className={styles.hubWrap}>
        <div className={styles.ambient} aria-hidden="true">
          <div className={styles.ambientGlowA} />
          <div className={styles.dotGrid} />
        </div>
        <p className={styles.empty}>
          No connections computed for this subject yet.
        </p>
        <p className={museum.note} style={{ textAlign: "center" }}>
          {note}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.hubWrap}>
      <div className={styles.ambient} aria-hidden="true">
        <div className={styles.ambientGlowA} />
        <div className={styles.ambientGlowB} />
        <div className={styles.dotGrid} />
      </div>

      <div className={styles.banner}>
        <div className={styles.bannerMeta}>
          <div className={styles.stamp}>
            <span className={styles.stampLabel}>Constellation · lens</span>
            <span className={styles.stampValue}>{subjectLabel}</span>
          </div>
          <span className={styles.statChip}>
            {connections.length} related subjects
          </span>
        </div>
        <p className={museum.note} style={{ margin: 0, maxWidth: "22rem" }}>
          {note}
        </p>
      </div>

      <div className={styles.hubField}>
        <svg className={styles.hubSvg} viewBox="0 0 100 100" aria-hidden="true">
          <defs>
            <linearGradient id="hubGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f2ca50" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#ffb691" stopOpacity="0.55" />
            </linearGradient>
          </defs>
          {positions.map((p) => (
            <line
              key={`e-${p.targetSlug}`}
              x1={CX}
              y1={CY}
              x2={p.left}
              y2={p.top}
              className={styles.hubEdge}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        {positions.map((p) => (
          <div
            key={`el-${p.targetSlug}`}
            className={styles.hubEdgeLabel}
            style={{ left: `${p.midLeft}%`, top: `${p.midTop}%` }}
          >
            {p.sharedWorkCount} shared works
          </div>
        ))}

        <div className={styles.hubCenter}>
          <div className={styles.hubCenterCard}>
            <div className={styles.hubCenterLabel}>Current subject</div>
            <p className={styles.hubCenterTitle}>{subjectLabel}</p>
          </div>
        </div>

        {positions.map((p) => {
          const sample = p.samples[0];
          const strength = Math.min(
            1,
            Math.max(0.35, p.connectionScore / Math.max(connections[0]?.connectionScore || 1, 0.01)),
          );
          return (
            <div
              key={p.targetSlug}
              style={{
                position: "absolute",
                left: `${p.left}%`,
                top: `${p.top}%`,
                transform: "translate(-50%, -50%)",
                zIndex: related === p.targetSlug ? 5 : 3,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.35rem",
                width: "7rem",
                opacity: 0.55 + strength * 0.45,
              }}
            >
              <button
                type="button"
                className={styles.satNode}
                style={{
                  position: "relative",
                  left: "auto",
                  top: "auto",
                  transform: "none",
                }}
                aria-pressed={related === p.targetSlug}
                onClick={() => selectRelated(p.targetSlug)}
              >
                <div className={styles.satCard}>
                  {sample ? (
                    <ArtworkImage
                      src={sample.imageUrl}
                      alt={sample.altText || sample.title || p.targetLabel}
                      width={sample.imageWidth}
                      height={sample.imageHeight}
                    />
                  ) : null}
                </div>
                <span className={styles.satTitle}>{p.targetLabel}</span>
                <span className={styles.satMeta}>
                  {p.sharedWorkCount} shared works
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <div className={styles.listFallback}>
        <ol>
          {connections.map((c) => (
            <li key={c.targetSlug}>
              <button
                type="button"
                aria-pressed={related === c.targetSlug}
                onClick={() => selectRelated(c.targetSlug)}
              >
                {c.targetLabel} · {c.sharedWorkCount} shared works
              </button>
            </li>
          ))}
        </ol>
      </div>

      {strip.length > 0 && (
        <section
          className={`${styles.intersection} ${related ? styles.intersectionActive : ""}`}
          aria-label="Shared works"
        >
          <h2 className={museum.chapterLabel}>
            {active
              ? `${active.sharedWorkCount} works are tagged with both ${subjectLabel} and ${active.targetLabel}`
              : "Sample shared works"}
          </h2>
          <div className={museum.strip}>
            {strip.map((work) => (
              <StripCell key={work.sourceId} work={work} open={open} />
            ))}
          </div>
          {active && (
            <div className={museum.ctaRow}>
              <Link
                href={subjectPath(active.targetSlug, "journey")}
                className={`${museum.button} ${museum.buttonPrimary}`}
              >
                Open {active.targetLabel} Journey
              </Link>
              {!related && (
                <button
                  type="button"
                  className={museum.button}
                  onClick={() => selectRelated(active.targetSlug)}
                >
                  View shared works
                </button>
              )}
              <Link
                href={subjectPath(subjectSlug, "journey")}
                className={museum.button}
              >
                Back to {subjectLabel} Journey
              </Link>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function StripCell({
  work,
  open,
}: {
  work: ArtworkCard;
  open: (id: string, el?: HTMLElement | null) => void;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={ref}
      type="button"
      className={museum.workButton}
      onClick={() => open(work.sourceId, ref.current)}
    >
      <ArtworkImage
        src={work.imageUrl}
        alt={work.altText || work.title || "Artwork"}
        width={work.imageWidth}
        height={work.imageHeight}
      />
      <div className={museum.workCaption}>
        <strong>{work.title || "Untitled"}</strong>
      </div>
    </button>
  );
}
