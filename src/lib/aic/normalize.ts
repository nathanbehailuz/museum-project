import type {
  ArticArtworkApi,
  NormalizedArtwork,
  NormalizedTermLink,
} from "./types";

const STOP = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "with",
  "from",
  "by",
  "as",
]);

const GENERIC = new Set([
  "art",
  "arts",
  "painting",
  "paintings",
  "drawing",
  "drawings",
  "print",
  "prints",
  "sculpture",
  "sculptures",
  "paper",
  "people",
  "person",
  "figure",
  "figures",
  "man",
  "woman",
  "men",
  "women",
  "work",
  "works",
  "object",
  "objects",
  "image",
  "images",
  "photograph",
  "photographs",
  "canvas",
  "oil",
  "watercolor",
  "ink",
  "graphite",
  "european painting",
  "american",
  "modernism",
  "paint",
  "oil paint paint",
  "oil painting",
  "oil on canvas",
  "oil paintings visual work",
  "painting technique",
  "painting image making",
  "painting coating",
  "prints and drawing",
  "paper fiber product",
  "organic material",
  "inorganic material",
  "textile",
  "weaving",
  "plain weaving",
  "costume",
  "french",
  "italian",
  "british",
  "dutch",
  "german",
  "spanish",
  "asian art",
  "modern and contemporary art",
  "century of progress",
  "world's fair",
  "chicago world's fair",
  "19th century",
  "20th century",
  "17th century",
  "18th century",
  "16th century",
  "15th century",
  "14th century",
  "nineteenth century",
]);

const DO_NOT_SINGULARIZE = new Set([
  "canvas",
  "glass",
  "brass",
  "bronze",
  "process",
  "cross",
  "grass",
  "dress",
  "press",
  "series",
  "species",
  "news",
]);

const IRREGULAR_PLURALS: Record<string, string> = {
  children: "child",
  geese: "goose",
  mice: "mouse",
  teeth: "tooth",
  feet: "foot",
  men: "man",
  women: "woman",
  leaves: "leaf",
  knives: "knife",
  wolves: "wolf",
  lives: "life",
};

/** Lowercase, NFKC, collapse space, light singularization for catalog nouns. */
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
  const last = parts[parts.length - 1]!;
  parts[parts.length - 1] = singularizeWord(last);
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

export function isLanguageRejected(canonical: string): string | null {
  if (!canonical) return "empty_after_normalize";
  if (/^\d+$/.test(canonical)) return "numeric_only";
  if (STOP.has(canonical)) return "stop_word";
  if (GENERIC.has(canonical)) return "generic_catalog_term";
  const tokens = canonical.split(" ");
  if (tokens.length === 1 && tokens[0]!.length < 3) return "too_short";
  return null;
}

export function normalizeArtwork(api: ArticArtworkApi): NormalizedArtwork {
  const sourceId = String(api.id);
  const subjects = (api.subject_titles ?? [])
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter(Boolean);
  const terms = (api.term_titles ?? [])
    .map((t) => (typeof t === "string" ? t.trim() : ""))
    .filter(Boolean);

  return {
    source: "artic",
    source_id: sourceId,
    title: emptyToNull(api.title),
    artist_title: emptyToNull(api.artist_title),
    date_start: api.date_start ?? null,
    date_end: api.date_end ?? null,
    date_display: emptyToNull(api.date_display),
    medium_display: emptyToNull(api.medium_display),
    artwork_type_title: emptyToNull(api.artwork_type_title),
    image_id: emptyToNull(api.image_id),
    image_width: api.thumbnail?.width ?? null,
    image_height: api.thumbnail?.height ?? null,
    alt_text: emptyToNull(api.alt_text ?? api.thumbnail?.alt_text),
    is_public_domain: api.is_public_domain === true,
    source_url: `https://www.artic.edu/artworks/${sourceId}`,
    subject_titles: subjects,
    term_titles: terms,
    raw_department: emptyToNull(api.department_title),
  };
}

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t.length ? t : null;
}

/** Qualifying catalog evidence only — title/description do not qualify. */
export function extractCatalogTermLinks(
  artwork: NormalizedArtwork,
): NormalizedTermLink[] {
  const links: NormalizedTermLink[] = [];
  const seen = new Set<string>();

  const push = (
    raw: string,
    evidence_source: "subject" | "term",
    weight: number,
  ) => {
    const canonical = normalizeTermLabel(raw);
    if (!canonical || seen.has(`${canonical}:${evidence_source}`)) return;
    seen.add(`${canonical}:${evidence_source}`);
    links.push({
      source_id: artwork.source_id,
      canonical,
      display_label: titleCase(canonical),
      evidence_source,
      relevance_weight: weight,
    });
  };

  for (const t of artwork.subject_titles) push(t, "subject", 1);
  for (const t of artwork.term_titles) push(t, "term", 0.85);
  return links;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function isDisplayableArtwork(a: NormalizedArtwork): boolean {
  return (
    a.is_public_domain &&
    !!a.image_id &&
    (a.image_width == null || a.image_width > 0) &&
    (a.image_height == null || a.image_height > 0) &&
    a.date_start != null
  );
}
