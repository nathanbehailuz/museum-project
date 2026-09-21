import { describe, expect, it } from "vitest";
import {
  extractCatalogTermLinks,
  isDisplayableArtwork,
  isLanguageRejected,
  normalizeArtwork,
  normalizeTermLabel,
  slugifyTerm,
} from "./normalize";
import { validateTerm } from "./validate";
import type { NormalizedArtwork } from "./types";

describe("normalizeTermLabel", () => {
  it("singularizes and lowercases", () => {
    expect(normalizeTermLabel("Windows")).toBe("window");
    expect(normalizeTermLabel("  CHAIRS ")).toBe("chair");
  });

  it("does not mangle canvas", () => {
    expect(normalizeTermLabel("canvas")).toBe("canvas");
    expect(normalizeTermLabel("oil on canvas")).toBe("oil on canvas");
  });
});

describe("isLanguageRejected", () => {
  it("rejects medium/century generics and stop words, not depicted people", () => {
    expect(isLanguageRejected("painting")).toBe("generic_catalog_term");
    expect(isLanguageRejected("the")).toBe("stop_word");
    expect(isLanguageRejected("window")).toBeNull();
    expect(isLanguageRejected("man")).toBeNull();
  });
});

describe("normalizeArtwork + evidence", () => {
  it("maps API fields and only catalogs qualify", () => {
    const a = normalizeArtwork({
      id: 1,
      title: "Window Study",
      artist_title: "Artist",
      date_start: 1900,
      image_id: "abc",
      thumbnail: { width: 100, height: 80 },
      is_public_domain: true,
      subject_titles: ["windows"],
      term_titles: ["interior"],
    });
    expect(a.source_id).toBe("1");
    expect(isDisplayableArtwork(a)).toBe(true);
    const links = extractCatalogTermLinks(a);
    expect(links.map((l) => l.canonical).sort()).toEqual(["interior", "window"]);
    expect(slugifyTerm("window")).toBe("window");
  });
});

function work(
  partial: Partial<NormalizedArtwork> & { source_id: string },
): NormalizedArtwork {
  return {
    source: "artic",
    title: "t",
    artist_title: partial.artist_title ?? `Artist ${partial.source_id}`,
    date_start: partial.date_start ?? 1800,
    date_end: null,
    date_display: null,
    medium_display: partial.medium_display ?? "Oil",
    artwork_type_title: partial.artwork_type_title ?? "Painting",
    image_id: "img",
    image_width: 100,
    image_height: 100,
    alt_text: null,
    is_public_domain: true,
    source_url: "https://example.com",
    subject_titles: ["window"],
    term_titles: [],
    raw_department: null,
    ...partial,
  };
}

describe("validateTerm", () => {
  it("marks journey_ready when thresholds pass", () => {
    const artworks = Array.from({ length: 5 }, (_, i) =>
      work({
        source_id: String(i),
        date_start: 1700 + i * 25,
        artist_title: `Maker ${i}`,
        artwork_type_title: i % 2 ? "Painting" : "Print",
      }),
    );
    const v = validateTerm({
      canonical: "window",
      display_label: "Window",
      artworks,
    });
    expect(v.status).toBe("journey_ready");
  });

  it("marks browse_only for shallow depth", () => {
    const artworks = Array.from({ length: 4 }, (_, i) =>
      work({ source_id: String(i), date_start: 1800 + i * 30, artist_title: `A${i}` }),
    );
    const v = validateTerm({
      canonical: "bowl",
      display_label: "Bowl",
      artworks,
    });
    expect(v.status).toBe("browse_only");
  });
});
