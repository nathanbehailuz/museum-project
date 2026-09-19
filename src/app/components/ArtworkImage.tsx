"use client";

import { useState } from "react";
import { iiifLarge, iiifThumb, aspectRatio } from "@/lib/aic/iiif";
import styles from "./museum.module.css";

type Props = {
  imageId: string | null;
  alt: string;
  width?: number | null;
  height?: number | null;
  large?: boolean;
  className?: string;
};

export default function ArtworkImage({
  imageId,
  alt,
  width,
  height,
  large,
  className,
}: Props) {
  const [failed, setFailed] = useState(false);
  const ratio = aspectRatio(width, height) ?? 0.8;

  const src =
    imageId && !failed
      ? large
        ? iiifLarge(imageId)
        : iiifThumb(imageId)
      : null;

  if (!src) {
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
      onError={() => setFailed(true)}
    />
  );
}
