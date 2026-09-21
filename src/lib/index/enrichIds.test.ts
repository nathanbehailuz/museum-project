import { describe, expect, it } from "vitest";
import { pickUncachedIds } from "./enrichIds";

describe("pickUncachedIds", () => {
  it("skips ids already in the cache and respects cap", () => {
    const catalog = ["1", "2", "3", "4", "5"];
    const cached = new Set(["2", "4"]);
    expect(pickUncachedIds(catalog, cached, 2)).toEqual(["1", "3"]);
  });

  it("returns empty when everything is cached", () => {
    expect(pickUncachedIds(["1", "2"], new Set(["1", "2"]), 8)).toEqual([]);
  });
});
