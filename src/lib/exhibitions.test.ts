import { describe, expect, it, vi } from "vitest";
import { loadExhibition } from "./exhibitions";
import { isEligibleMetObject, normalizeMetObject, ARTWORK_FIELDS } from "./met/normalize";
import { isSupportedSubject, getSubjectOrNull } from "./subjects";
import type { MetObject } from "./met/normalize";

const eligibleFixture: MetObject = {
  objectID: 9817,
  title: "Stained-glass window",
  artistDisplayName: "Evert Duyckinck",
  objectDate: "ca. 1656",
  medium: "Painted leaded glass",
  primaryImage: "https://images.metmuseum.org/CRDImages/ad/original/DT2731.jpg",
  primaryImageSmall: "https://images.metmuseum.org/CRDImages/ad/web-large/DT2731.jpg",
  isPublicDomain: true,
  objectURL: "https://www.metmuseum.org/art/collection/search/9817",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("subject validation (P2-4)", () => {
  it("rejects unsupported subjects without calling fetch", async () => {
    const fetchImpl = vi.fn();
    const result = await loadExhibition("cats", { fetchImpl });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("invalid_subject");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(isSupportedSubject("cats")).toBe(false);
    expect(getSubjectOrNull("windows")?.slug).toBe("windows");
  });

  it("rejects null/empty subject", async () => {
    const fetchImpl = vi.fn();
    expect((await loadExhibition(null, { fetchImpl })).ok).toBe(false);
    expect((await loadExhibition("  ", { fetchImpl })).ok).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("eligibility and normalize (P2-5, P2-6)", () => {
  it("excludes non-public-domain and missing primaryImage", () => {
    expect(
      isEligibleMetObject({ ...eligibleFixture, isPublicDomain: false }),
    ).toBe(false);
    expect(isEligibleMetObject({ ...eligibleFixture, primaryImage: "" })).toBe(false);
    expect(isEligibleMetObject({ ...eligibleFixture, primaryImage: "   " })).toBe(
      false,
    );
    expect(normalizeMetObject({ ...eligibleFixture, isPublicDomain: false })).toBeNull();
  });

  it("normalizes only UI fields and treats empty strings as absent", () => {
    const artwork = normalizeMetObject({
      ...eligibleFixture,
      artistDisplayName: "",
      medium: "   ",
    });
    expect(artwork).not.toBeNull();
    expect(Object.keys(artwork!).sort()).toEqual([...ARTWORK_FIELDS].sort());
    expect(artwork!.artist).toBeNull();
    expect(artwork!.medium).toBeNull();
    expect(artwork!.title).toBe("Stained-glass window");
    expect(artwork!.image.small).toContain("metmuseum.org");
  });
});

describe("exhibition loading (P2-7, P2-8)", () => {
  it("returns insufficient_content when fewer than three IDs are configured", async () => {
    const fetchImpl = vi.fn();
    const result = await loadExhibition("windows", {
      fetchImpl,
      artworkIds: [9817, 14808],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("insufficient_content");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("returns insufficient_content when fetched records are ineligible", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        objectID: 1,
        title: "Private work",
        isPublicDomain: false,
        primaryImage: "",
      }),
    );
    const result = await loadExhibition("windows", {
      fetchImpl,
      artworkIds: [1, 2, 3],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("insufficient_content");
    }
  });

  it("maps upstream timeout/failure to upstream_error", async () => {
    const fetchImpl = vi.fn(async () => {
      await new Promise((r) => setTimeout(r, 30));
      throw new Error("network down");
    });
    const result = await loadExhibition("windows", {
      fetchImpl,
      artworkIds: [1, 2, 3],
      deadlineMs: 5,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("upstream_error");
    }
  });

  it("returns three artworks on success", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const id = Number(url.split("/").pop());
      return jsonResponse({
        ...eligibleFixture,
        objectID: id,
        title: `Work ${id}`,
      });
    });
    const result = await loadExhibition("windows", {
      fetchImpl,
      artworkIds: [10, 20, 30],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.subject).toBe("windows");
      expect(result.title).toBe("Windows");
      expect(result.artworks).toHaveLength(3);
      expect(result.artworks.map((a) => a.id)).toEqual([10, 20, 30]);
    }
  });
});
