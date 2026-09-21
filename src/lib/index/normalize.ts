import type { NormalizedArtwork, NormalizedTermLink } from "./types";

const STOP = new Set([
  "a", "an", "the", "and", "or", "of", "in", "on", "at", "to", "for", "with", "from", "by", "as",
]);

/** Medium / technique / format / nationality / century — not depicted motifs. */
const GENERIC = new Set([
  "art", "arts", "painting", "paintings", "drawing", "drawings", "print", "prints",
  "sculpture", "sculptures", "paper", "work", "works", "object", "objects", "image", "images",
  "photograph", "photographs", "canvas", "oil", "watercolor", "ink", "graphite",
  "american", "european", "french", "italian", "british", "dutch", "german", "spanish",
  "19th century", "20th century", "18th century", "17th century", "16th century",
]);

const DO_NOT_SINGULARIZE = new Set([
  "canvas", "glass", "brass", "bronze", "process", "cross", "grass", "dress", "press",
  "series", "species", "news",
]);

const IRREGULAR_PLURALS: Record<string, string> = {
  children: "child", geese: "goose", mice: "mouse", teeth: "tooth", feet: "foot",
  men: "man", women: "woman", leaves: "leaf", knives: "knife", wolves: "wolf", lives: "life",
};

export type MetObjectApi = {
  objectID?: number;
  title?: string;
  artistDisplayName?: string;
  objectDate?: string;
  objectBeginDate?: number;
  objectEndDate?: number;
  medium?: string;
  objectName?: string;
  primaryImage?: string;
  primaryImageSmall?: string;
  isPublicDomain?: boolean;
  objectURL?: string;
  department?: string;
  tags?: Array<{ term?: string } | string> | null;
};

export function normalizeTermLabel(raw: string): string {
  const collapsed = raw
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[()]/g, " ")
    .replace(/[_/]+/g, " ")
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!collapsed) return "";
  return singularizePhrase(collapsed);
}

function singularizePhrase(phrase: string): string {
  const parts = phrase.split(" ");
  parts[parts.length - 1] = singularizeWord(parts[parts.length - 1]!);
  return parts.join(" ");
}

function singularizeWord(word: string): string {
  if (IRREGULAR_PLURALS[word]) return IRREGULAR_PLURALS[word]!;
  if (DO_NOT_SINGULARIZE.has(word)) return word;
  if (word.length <= 3) return word;
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith("sses") || word.endsWith("ches") || word.endsWith("shes")) {
    return word.slice(0, -2);
  }
  if (word.endsWith("ses") && !word.endsWith("sses")) return word.slice(0, -1);
  if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us")) {
    return word.slice(0, -1);
  }
  return word;
}

export function slugifyTerm(canonical: string): string {
  return canonical
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function isGenericCanonical(canonical: string): boolean {
  return GENERIC.has(canonical);
}

export function isLanguageRejected(canonical: string): string | null {
  if (!canonical) return "empty_after_normalize";
  if (/^\d+$/.test(canonical)) return "numeric_only";
  if (STOP.has(canonical)) return "stop_word";
  if (GENERIC.has(canonical)) return "generic_catalog_term";
  const tokens = canonical.split(" ");
  if (tokens.length === 1 && tokens[0]!.length < 3) return "too_short";
  return null;
}

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length ? t : null;
}

function parseTags(tags: MetObjectApi["tags"]): string[] {
  if (!tags?.length) return [];
  const out: string[] = [];
  for (const t of tags) {
    if (typeof t === "string" && t.trim()) out.push(t.trim());
    else if (t && typeof t === "object" && typeof t.term === "string" && t.term.trim()) {
      out.push(t.term.trim());
    }
  }
  return out;
}

export function normalizeMetObject(obj: MetObjectApi): NormalizedArtwork | null {
  const id = obj.objectID;
  if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) return null;
  const imageFull = emptyToNull(obj.primaryImage);
  const imageSmall = emptyToNull(obj.primaryImageSmall) ?? imageFull;
  if (!imageFull && !imageSmall) return null;

  const tags = parseTags(obj.tags);
  return {
    source: "met",
    source_id: String(id),
    title: emptyToNull(obj.title),
    artist_title: emptyToNull(obj.artistDisplayName),
    date_start:
      typeof obj.objectBeginDate === "number" && Number.isFinite(obj.objectBeginDate)
        ? obj.objectBeginDate
        : null,
    date_end:
      typeof obj.objectEndDate === "number" && Number.isFinite(obj.objectEndDate)
        ? obj.objectEndDate
        : null,
    date_display: emptyToNull(obj.objectDate),
    medium_display: emptyToNull(obj.medium),
    artwork_type_title: emptyToNull(obj.objectName),
    image_url: imageFull ?? imageSmall,
    image_url_small: imageSmall,
    image_width: null,
    image_height: null,
    alt_text: emptyToNull(obj.title),
    is_public_domain: obj.isPublicDomain === true,
    source_url:
      emptyToNull(obj.objectURL) ??
      `https://www.metmuseum.org/art/collection/search/${id}`,
    subject_titles: tags,
    term_titles: [],
    raw_department: emptyToNull(obj.department),
  };
}

export function extractCatalogTermLinks(
  artwork: NormalizedArtwork,
): NormalizedTermLink[] {
  const links: NormalizedTermLink[] = [];
  const seen = new Set<string>();
  for (const raw of artwork.subject_titles) {
    const canonical = normalizeTermLabel(raw);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    links.push({
      source_id: artwork.source_id,
      canonical,
      display_label: titleCase(canonical),
      evidence_source: "tag",
      relevance_weight: 1,
    });
  }
  return links;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isDisplayableArtwork(a: NormalizedArtwork): boolean {
  return (
    a.is_public_domain &&
    !!(a.image_url_small || a.image_url) &&
    a.date_start != null
  );
}
