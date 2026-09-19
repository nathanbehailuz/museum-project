import { describe, expect, it } from "vitest";
import {
  parseSubjectSearchParams,
  serializeSubjectSearchParams,
  subjectPath,
} from "./subjectUrlState";

describe("subjectUrlState", () => {
  it("round-trips filters", () => {
    const q = serializeSubjectSearchParams({
      chapter: 2,
      artwork: "16568",
      sort: "artist",
      from: 1800,
      page: 3,
    });
    const parsed = parseSubjectSearchParams(new URLSearchParams(q.slice(1)));
    expect(parsed.chapter).toBe(2);
    expect(parsed.artwork).toBe("16568");
    expect(parsed.sort).toBe("artist");
    expect(parsed.from).toBe(1800);
    expect(parsed.page).toBe(3);
  });

  it("builds subject paths", () => {
    expect(subjectPath("flower", "journey")).toBe("/subject/flower/journey");
    expect(subjectPath("flower", "works", { page: 2, sort: "title" })).toBe(
      "/subject/flower/works?sort=title&page=2",
    );
  });
});
