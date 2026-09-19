import { describe, expect, it } from "vitest";
import {
  commitTitle,
  MAX_TITLE_LENGTH,
  parseExhibitionSearchParams,
  serializeExhibitionState,
} from "./urlState";

describe("url state (P3-6, P3-9, P3-4)", () => {
  it("defaults when search is empty", () => {
    const result = parseExhibitionSearchParams(new URLSearchParams());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.subject).toBe("windows");
      expect(result.state.ids).toEqual([9817, 14808, 453573]);
      expect(result.state.title).toBe("Windows");
      expect(result.usedDefaultTitle).toBe(true);
    }
  });

  it("round-trips serialize/parse", () => {
    const qs = serializeExhibitionState({
      subject: "chairs",
      ids: [221, 230, 269],
      title: "Soft seats",
    });
    const result = parseExhibitionSearchParams(
      new URLSearchParams(qs.replace(/^\?/, "")),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).toEqual({
        subject: "chairs",
        ids: [221, 230, 269],
        title: "Soft seats",
      });
    }
  });

  it("rejects unsupported subject, bad counts, duplicates, non-pool ids, long titles", () => {
    expect(
      parseExhibitionSearchParams(
        new URLSearchParams("subject=cats&ids=1,2,3&title=x"),
      ).ok,
    ).toBe(false);

    expect(
      parseExhibitionSearchParams(
        new URLSearchParams("subject=windows&ids=9817,14808&title=x"),
      ).ok,
    ).toBe(false);

    expect(
      parseExhibitionSearchParams(
        new URLSearchParams("subject=windows&ids=9817,9817,14808&title=x"),
      ).ok,
    ).toBe(false);

    expect(
      parseExhibitionSearchParams(
        new URLSearchParams("subject=windows&ids=1,2,3&title=x"),
      ).ok,
    ).toBe(false);

    const long = "a".repeat(MAX_TITLE_LENGTH + 1);
    const longResult = parseExhibitionSearchParams(
      new URLSearchParams(
        `subject=windows&ids=9817,14808,453573&title=${long}`,
      ),
    );
    expect(longResult.ok).toBe(false);
    if (!longResult.ok) expect(longResult.error).toBe("title_too_long");
  });

  it("commitTitle restores default on whitespace and clamps length", () => {
    expect(commitTitle("   ", "Windows")).toBe("Windows");
    expect(commitTitle("  Hello  ", "Windows")).toBe("Hello");
    expect(commitTitle("x".repeat(100), "Windows").length).toBe(MAX_TITLE_LENGTH);
  });
});
