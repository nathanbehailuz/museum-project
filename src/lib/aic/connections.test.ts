import { describe, expect, it } from "vitest";
import {
  computeConnections,
  connectionScore,
  type TermMeta,
} from "./connections";
import { computeTermPeriods } from "./periods";

describe("connectionScore", () => {
  it("uses cosine-style normalization", () => {
    expect(connectionScore(3, 9, 4)).toBeCloseTo(3 / Math.sqrt(36), 6);
    expect(connectionScore(0, 9, 4)).toBe(0);
  });
});

function term(
  partial: Partial<TermMeta> & Pick<TermMeta, "id" | "canonical">,
): TermMeta {
  return {
    slug: partial.canonical,
    aliases: [],
    status: "journey_ready",
    ...partial,
  };
}

describe("computeConnections", () => {
  it("requires min shared works and returns top-K", () => {
    const flower = term({ id: "t-flower", canonical: "flower" });
    const bird = term({ id: "t-bird", canonical: "bird" });
    const tree = term({ id: "t-tree", canonical: "tree" });
    const painting = term({
      id: "t-paint",
      canonical: "painting",
      status: "unavailable",
    });

    const artworkTermSets = new Map<string, Set<string>>([
      ["a1", new Set(["t-flower", "t-bird", "t-paint"])],
      ["a2", new Set(["t-flower", "t-bird"])],
      ["a3", new Set(["t-flower", "t-bird", "t-tree"])],
      ["a4", new Set(["t-flower", "t-tree"])],
      ["a5", new Set(["t-flower", "t-tree"])],
      ["a6", new Set(["t-flower", "t-tree"])],
      // bird-tree only twice — below min 3
      ["a7", new Set(["t-bird", "t-tree"])],
      ["a8", new Set(["t-bird", "t-tree"])],
    ]);

    const edges = computeConnections({
      terms: [flower, bird, tree, painting],
      artworkTermSets,
      topK: 2,
      minShared: 3,
    });

    const fromFlower = edges.filter((e) => e.source_term_id === "t-flower");
    expect(fromFlower.length).toBeLessThanOrEqual(2);
    expect(fromFlower.every((e) => e.shared_work_count >= 3)).toBe(true);
    expect(fromFlower.some((e) => e.target_term_id === "t-paint")).toBe(false);

    const flowerBird = fromFlower.find((e) => e.target_term_id === "t-bird");
    expect(flowerBird?.sample_artwork_ids.every((id) =>
      ["a1", "a2", "a3"].includes(id),
    )).toBe(true);
  });

  it("drops alias pairs", () => {
    const window = term({
      id: "t-window",
      canonical: "window",
      aliases: ["windows"],
    });
    const windows = term({
      id: "t-windows",
      canonical: "windows",
      status: "browse_only",
    });
    const light = term({ id: "t-light", canonical: "light" });

    const artworkTermSets = new Map<string, Set<string>>([
      ["a1", new Set(["t-window", "t-windows", "t-light"])],
      ["a2", new Set(["t-window", "t-windows", "t-light"])],
      ["a3", new Set(["t-window", "t-windows", "t-light"])],
    ]);

    const edges = computeConnections({
      terms: [window, windows, light],
      artworkTermSets,
    });
    expect(
      edges.some(
        (e) =>
          (e.source_term_id === "t-window" &&
            e.target_term_id === "t-windows") ||
          (e.source_term_id === "t-windows" && e.target_term_id === "t-window"),
      ),
    ).toBe(false);
    expect(
      edges.some(
        (e) =>
          e.source_term_id === "t-window" && e.target_term_id === "t-light",
      ),
    ).toBe(true);
  });
});

describe("computeTermPeriods", () => {
  it("buckets by 50-year intervals and diversifies featured artists", () => {
    const periods = computeTermPeriods("t1", [
      { id: "a1", date_start: 1705, artist_title: "A" },
      { id: "a2", date_start: 1710, artist_title: "A" },
      { id: "a3", date_start: 1720, artist_title: "B" },
      { id: "a4", date_start: 1801, artist_title: "C" },
    ]);
    expect(periods).toHaveLength(2);
    expect(periods[0]!.label).toBe("1700–1749");
    expect(periods[0]!.featured_artwork_ids[0]).toBe("a1");
    expect(periods[0]!.featured_artwork_ids).toContain("a3");
    expect(periods[1]!.begin_year).toBe(1800);
  });
});
