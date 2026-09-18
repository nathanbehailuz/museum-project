import type { Artwork } from "../types";

/** Met object JSON fields we care about. */
export type MetObject = {
  objectID?: number;
  title?: string;
  artistDisplayName?: string;
  objectDate?: string;
  medium?: string;
  primaryImage?: string;
  primaryImageSmall?: string;
  isPublicDomain?: boolean;
  objectURL?: string;
};

function clean(value: string | undefined | null): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function isEligibleMetObject(obj: MetObject): boolean {
  const primary = clean(obj.primaryImage);
  return obj.isPublicDomain === true && primary !== null;
}

/**
 * Normalize a Met object into the app artwork shape.
 * Returns null when the record is ineligible (not public domain or no primary image).
 */
export function normalizeMetObject(obj: MetObject): Artwork | null {
  if (!isEligibleMetObject(obj)) return null;

  const id = obj.objectID;
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) {
    return null;
  }

  const primary = clean(obj.primaryImage)!;
  const small = clean(obj.primaryImageSmall) ?? primary;

  return {
    id,
    title: clean(obj.title) ?? "Untitled",
    artist: clean(obj.artistDisplayName),
    date: clean(obj.objectDate),
    medium: clean(obj.medium),
    image: { primary, small },
    isPublicDomain: true,
    objectURL: clean(obj.objectURL),
  };
}

/** Fields returned to the UI — used by tests to assert B03 shape. */
export const ARTWORK_FIELDS = [
  "id",
  "title",
  "artist",
  "date",
  "medium",
  "image",
  "isPublicDomain",
  "objectURL",
] as const;
