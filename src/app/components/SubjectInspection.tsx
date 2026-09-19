"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ArtworkCard } from "@/lib/aic/apiTypes";
import ArtworkImage from "./ArtworkImage";
import styles from "./museum.module.css";

type Props = {
  sourceId: string;
  onClose: () => void;
  returnFocusRef: React.RefObject<HTMLElement | null>;
};

export default function SubjectInspection({
  sourceId,
  onClose,
  returnFocusRef,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const [artwork, setArtwork] = useState<
    (ArtworkCard & { subjectTitles?: string[]; termTitles?: string[] }) | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setArtwork(null);
    setError(null);
    setZoom(1);
    fetch(`/api/artworks/${encodeURIComponent(sourceId)}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? "Failed to load");
        if (!cancelled) setArtwork(json.artwork);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [sourceId]);

  useEffect(() => {
    const previouslyFocused = returnFocusRef.current;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus();
    };
  }, [onClose, returnFocusRef]);

  return (
    <div
      className={`${styles.inspectBackdrop} ${styles.inspectEnter}`}
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        className={styles.inspectDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.inspectToolbar}>
          <button
            ref={closeRef}
            type="button"
            className={styles.button}
            onClick={onClose}
          >
            Close
          </button>
          <div className={styles.zoomControls} aria-label="Zoom">
            <button
              type="button"
              className={styles.button}
              onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
            >
              −
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => setZoom(1)}
            >
              Reset
            </button>
            <button
              type="button"
              className={styles.button}
              onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
            >
              +
            </button>
          </div>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        {!artwork && !error && (
          <p className={styles.muted} aria-live="polite">
            Loading artwork…
          </p>
        )}
        {artwork && (
          <>
            <div
              className={styles.inspectImageWrap}
              style={{ transform: `scale(${zoom})` }}
            >
              <ArtworkImage
                src={artwork.imageUrl}
                alt={
                  artwork.altText ||
                  artwork.title ||
                  "Artwork"
                }
                width={artwork.imageWidth}
                height={artwork.imageHeight}
              />
            </div>
            <h2 id={titleId} className={styles.inspectTitle}>
              {artwork.title || "Untitled"}
            </h2>
            <dl className={styles.metaList}>
              <div>
                <dt>Artist</dt>
                <dd>{artwork.artistTitle || "Artist unknown"}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{artwork.dateDisplay || "Date unknown"}</dd>
              </div>
              <div>
                <dt>Medium</dt>
                <dd>{artwork.mediumDisplay || "—"}</dd>
              </div>
              <div>
                <dt>Museum</dt>
                <dd>The Metropolitan Museum of Art</dd>
              </div>
            </dl>
            {artwork.subjectTitles && artwork.subjectTitles.length > 0 && (
              <p className={styles.muted}>
                Tags: {artwork.subjectTitles.slice(0, 12).join(", ")}
              </p>
            )}
            <p>
              <a href={artwork.sourceUrl} target="_blank" rel="noreferrer">
                View on metmuseum.org
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
