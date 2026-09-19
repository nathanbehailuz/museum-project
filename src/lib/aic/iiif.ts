const IIIF_BASE = "https://www.artic.edu/iiif/2";

/** Direct AIC IIIF URL — used by the ingest mirror script only. */
export function iiifUrl(imageId: string, width: number = 843): string {
  return `${IIIF_BASE}/${imageId}/full/${width},/0/default.jpg`;
}

/** Public Supabase Storage URL for a mirrored 843px JPEG. */
export function iiifStorageUrl(
  imageId: string,
  width: number = 843,
): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/iiif/${imageId}/${width}.jpg`;
}

export function iiifThumb(imageId: string): string | null {
  return iiifStorageUrl(imageId, 843);
}

export function iiifLarge(imageId: string): string | null {
  return iiifStorageUrl(imageId, 843);
}

export function aspectRatio(
  width: number | null | undefined,
  height: number | null | undefined,
): number | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  return width / height;
}
