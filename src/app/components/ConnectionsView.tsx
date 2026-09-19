"use client";

import { useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ArtworkCard, ConnectionEdgeCard } from "@/lib/aic/apiTypes";
import { subjectPath } from "@/lib/subjectUrlState";
import ArtworkImage from "./ArtworkImage";
import { useOpenArtwork } from "./SubjectShell";
import styles from "./museum.module.css";

type Props = {
  subjectSlug: string;
  subjectLabel: string;
  connections: ConnectionEdgeCard[];
  related: string | null;
  intersection: ArtworkCard[];
  note: string;
};

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
  const active =
    connections.find((c) => c.targetSlug === related) ?? connections[0];
  const strip =
    related && intersection.length
      ? intersection
      : (active?.samples ?? []);

  return (
    <div>
      <p className={styles.note}>{note}</p>
      {!connections.length ? (
        <p className={styles.muted}>No connections computed for this subject yet.</p>
      ) : (
        <div className={styles.connectionsLayout}>
          <ol className={styles.connList}>
            {connections.map((c) => (
              <li key={c.targetSlug}>
                <button
                  type="button"
                  aria-pressed={related === c.targetSlug}
                  onClick={() => selectRelated(c.targetSlug)}
                >
                  <strong>{c.targetLabel}</strong>
                  <span className={styles.muted}>
                    {" "}
                    · {c.sharedWorkCount} shared
                  </span>
                </button>
                <div style={{ marginBottom: "0.5rem" }}>
                  <Link href={subjectPath(c.targetSlug, "journey")}>
                    Journey
                  </Link>
                  {" · "}
                  <Link href={subjectPath(c.targetSlug, "works")}>Works</Link>
                </div>
              </li>
            ))}
          </ol>

          <div className={styles.radial} aria-hidden="true">
            <div className={styles.radialCenter}>{subjectLabel}</div>
            {radial.map((c, i) => {
              const angle = (i / radial.length) * Math.PI * 2 - Math.PI / 2;
              const r = 42;
              const left = 50 + r * Math.cos(angle);
              const top = 50 + r * Math.sin(angle);
              return (
                <button
                  key={c.targetSlug}
                  type="button"
                  className={styles.radialNode}
                  style={{ left: `${left}%`, top: `${top}%` }}
                  aria-pressed={related === c.targetSlug}
                  onClick={() => selectRelated(c.targetSlug)}
                >
                  {c.targetLabel}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {strip.length > 0 && (
        <section aria-label="Shared works">
          <h2 className={styles.chapterLabel}>
            {related
              ? `Shared with ${active?.targetLabel ?? related}`
              : "Sample shared works"}
          </h2>
          <div className={styles.strip}>
            {strip.map((work) => (
              <StripCell
                key={work.sourceId}
                work={work}
                open={open}
              />
            ))}
          </div>
          {related && (
            <p>
              <Link href={subjectPath(subjectSlug, "works")}>
                Browse all works for {subjectLabel}
              </Link>
            </p>
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
      className={styles.workButton}
      onClick={() => open(work.sourceId, ref.current)}
    >
      <ArtworkImage
        src={work.imageUrl}
        alt={work.altText || work.title || "Artwork"}
        width={work.imageWidth}
        height={work.imageHeight}
      />
      <div className={styles.workCaption}>
        <strong>{work.title || "Untitled"}</strong>
      </div>
    </button>
  );
}
