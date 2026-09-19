"use client";

import { useEffect, useId, useRef } from "react";
import Image from "next/image";
import type { Artwork } from "@/lib/types";
import styles from "./gallery.module.css";

function labelOrFallback(value: string | null, fallback: string) {
  return value && value.trim() ? value : fallback;
}

type Props = {
  artwork: Artwork;
  onClose: () => void;
  returnFocusRef: React.RefObject<HTMLElement | null>;
};

export default function InspectionModal({
  artwork,
  onClose,
  returnFocusRef,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

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
      if (focusable.length === 0) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
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
    <div className={styles.modalRoot} role="presentation">
      <div
        className={styles.modalBackdrop}
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <button
          ref={closeRef}
          type="button"
          className={styles.modalClose}
          onClick={onClose}
          aria-label="Close artwork details"
        >
          Close
        </button>
        <div className={styles.modalImageWrap}>
          <Image
            src={artwork.image.primary}
            alt={artwork.title}
            width={1200}
            height={1600}
            className={styles.modalImage}
            sizes="100vw"
            unoptimized
          />
        </div>
        <div className={styles.modalBody}>
          <h2 id={titleId} className={styles.modalTitle}>
            {artwork.title}
          </h2>
          <p className={styles.modalCredit}>
            {labelOrFallback(artwork.artist, "Artist unknown")}
            <span aria-hidden="true"> · </span>
            {labelOrFallback(artwork.date, "Date unknown")}
          </p>
          <p className={styles.modalMedium}>
            {labelOrFallback(artwork.medium, "Medium unknown")}
          </p>
          {artwork.objectURL ? (
            <p className={styles.modalLink}>
              <a href={artwork.objectURL} target="_blank" rel="noreferrer">
                View at The Met
              </a>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
