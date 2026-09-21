import { describe, expect, it } from "vitest";
import {
  formatDateDisplay,
  formatSubjectMeta,
  formatYear,
  formatYearRange,
} from "./formatDate";

describe("formatYear", () => {
  it("formats BCE years", () => {
    expect(formatYear(-5)).toBe("5 BCE");
    expect(formatYear(-1400)).toBe("1400 BCE");
  });

  it("formats CE years plainly", () => {
    expect(formatYear(1860)).toBe("1860");
  });
});

describe("formatYearRange", () => {
  it("joins span", () => {
    expect(formatYearRange(-5, 1891)).toBe("5 BCE–1891");
  });

  it("does not show negative years for BCE ranges", () => {
    expect(formatYearRange(-50, -1)).toBe("50 BCE–1 BCE");
  });
});

describe("formatDateDisplay", () => {
  it("normalizes ca.. punctuation", () => {
    expect(formatDateDisplay("ca..1770")).toBe("ca. 1770");
    expect(formatDateDisplay("ca.1770")).toBe("ca. 1770");
  });

  it("rewrites leading negative years", () => {
    expect(formatDateDisplay("-5")).toBe("5 BCE");
  });
});

describe("formatSubjectMeta", () => {
  it("includes works and range", () => {
    expect(formatSubjectMeta(194, -5, 1891)).toBe("194 works · 5 BCE–1891");
  });
});
