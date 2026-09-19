"use client";

import { useState } from "react";
import styles from "./museum.module.css";

type Props = {
  src: string | null;
  alt: string;
  width?: number | null;
  height?: number | null;
  className?: string;
};

function aspectRatio(
  width: number | null | undefined,
  height: number | null | undefined,
): number {
  if (!width || !height || width <= 0 || height <= 0) return 0.8;
  return width / height;
}

export default function ArtworkImage({
  src,
  alt,
  width,
  height,
  className,
}: Props) {
  const [failed, setFailed] = useState(false);
  const ratio = aspectRatio(width, height);

  if (!src || failed) {
    return (
      <div
        className={`${styles.imageFallback} ${className ?? ""}`}
        style={{ aspectRatio: String(ratio) }}
        role="img"
        aria-label="Image unavailable"
      >
        Image unavailable
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={`${styles.artworkImg} ${className ?? ""}`}
      style={{ aspectRatio: String(ratio) }}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
