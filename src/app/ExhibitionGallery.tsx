"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import type { Artwork, ExhibitionResponse } from "@/lib/types";
import styles from "./gallery.module.css";

type Status = "loading" | "ready" | "empty" | "error";

function labelOrFallback(value: string | null, fallback: string) {
  return value && value.trim() ? value : fallback;
}

function ArtworkSkeleton({ index }: { index: number }) {
  return (
    <article className={styles.slot} aria-hidden="true">
      <div className={`${styles.frame} ${styles.skeletonFrame}`}>
        <div className={styles.skeletonImage} data-index={index} />
      </div>
      <div className={styles.meta}>
        <div className={`${styles.skeletonLine} ${styles.skeletonTitle}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonSub}`} />
      </div>
    </article>
  );
}

function ArtworkCard({ artwork }: { artwork: Artwork }) {
  return (
    <article className={styles.slot}>
      <div className={styles.frame}>
        <Image
          src={artwork.image.small}
          alt={artwork.title}
          width={843}
          height={1124}
          className={styles.image}
          sizes="(max-width: 768px) 100vw, 33vw"
          unoptimized
        />
      </div>
      <div className={styles.meta}>
        <h2 className={styles.workTitle}>{artwork.title}</h2>
        <p className={styles.workCredit}>
          <span>{labelOrFallback(artwork.artist, "Artist unknown")}</span>
          <span aria-hidden="true"> · </span>
          <span>{labelOrFallback(artwork.date, "Date unknown")}</span>
        </p>
      </div>
    </article>
  );
}

export default function ExhibitionGallery() {
  const [status, setStatus] = useState<Status>("loading");
  const [title, setTitle] = useState("Windows");
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  const load = useCallback(async (signal: AbortSignal) => {
    setStatus("loading");
    setMessage(null);

    try {
      const res = await fetch("/api/exhibitions?subject=windows", {
        signal,
        cache: "no-store",
      });
      const data = (await res.json()) as ExhibitionResponse;

      if (signal.aborted) return;

      if (!data.ok) {
        if (data.error === "insufficient_content") {
          setStatus("empty");
          setMessage(data.message);
          setArtworks([]);
          return;
        }
        setStatus("error");
        setMessage(data.message);
        setArtworks([]);
        return;
      }

      setTitle(data.title);
      setArtworks(data.artworks);
      setStatus("ready");
    } catch (err) {
      if (signal.aborted) return;
      setStatus("error");
      setMessage(
        err instanceof Error && err.name === "AbortError"
          ? "The request was cancelled."
          : "Could not load the exhibition. Please try again.",
      );
      setArtworks([]);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, requestKey]);

  const retry = () => setRequestKey((k) => k + 1);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <p className={styles.brand}>Museum Exhibition Maker</p>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.lede}>
          Three works about something you almost missed.
        </p>
      </header>

      <div
        className={styles.status}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {status === "loading" ? "Loading exhibition…" : null}
        {status === "empty" ? message : null}
        {status === "error" ? message : null}
        {status === "ready" ? "Exhibition loaded." : null}
      </div>

      {status === "loading" && (
        <section className={styles.gallery} aria-busy="true" aria-label="Loading artworks">
          <ArtworkSkeleton index={0} />
          <ArtworkSkeleton index={1} />
          <ArtworkSkeleton index={2} />
        </section>
      )}

      {status === "ready" && (
        <section className={styles.gallery} aria-label="Exhibition artworks">
          {artworks.map((artwork) => (
            <ArtworkCard key={artwork.id} artwork={artwork} />
          ))}
        </section>
      )}

      {(status === "empty" || status === "error") && (
        <section className={styles.recovery} aria-label="Exhibition unavailable">
          <p className={styles.recoveryText}>
            {status === "empty"
              ? message ?? "Not enough eligible artworks are available."
              : message ?? "Something went wrong while contacting the museum."}
          </p>
          {status === "error" && (
            <button type="button" className={styles.retry} onClick={retry}>
              Try again
            </button>
          )}
        </section>
      )}
    </main>
  );
}
