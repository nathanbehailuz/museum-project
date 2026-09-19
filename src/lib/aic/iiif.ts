const IIIF_BASE = "https://www.artic.edu/iiif/2";

export function iiifUrl(
  imageId: string,
  width: number = 843,
): string {
  return `${IIIF_BASE}/${imageId}/full/${width},/0/default.jpg`;
}

export function iiifThumb(imageId: string): string {
  return iiifUrl(imageId, 400);
}

export function iiifLarge(imageId: string): string {
  return iiifUrl(imageId, 1686);
}

export function aspectRatio(
  width: number | null | undefined,
  height: number | null | undefined,
): number | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  return width / height;
}
