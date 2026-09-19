import { describe, expect, it, vi } from "vitest";
import { fetchMetObject, MetFetchError } from "./client";
import { pickReplacementId, getPublishedSubject } from "../subjects";

describe("replacement pool (P3-1)", () => {
  it("excludes current selections when picking a replacement id", () => {
    const chairs = getPublishedSubject("chairs");
    expect(chairs).not.toBeNull();
    const pick = pickReplacementId(chairs!, [221, 230, 269]);
    expect(pick).not.toBeNull();
    expect([221, 230, 269]).not.toContain(pick);
  });
});

describe("met retry (P3-13)", () => {
  it("retries transient 503 then succeeds", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("nope", { status: 503 });
      }
      return new Response(
        JSON.stringify({
          objectID: 221,
          title: "Armchair",
          isPublicDomain: true,
          primaryImage: "https://images.metmuseum.org/x.jpg",
          primaryImageSmall: "https://images.metmuseum.org/x-small.jpg",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const obj = await fetchMetObject(221, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      useCache: false,
      timeoutMs: 2000,
    });
    expect(obj.objectID).toBe(221);
    expect(calls).toBe(2);
  });

  it("does not retry permanent 404", async () => {
    const fetchImpl = vi.fn(async () => new Response("missing", { status: 404 }));
    await expect(
      fetchMetObject(999, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        useCache: false,
        timeoutMs: 2000,
      }),
    ).rejects.toBeInstanceOf(MetFetchError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("honors Retry-After within retry budget", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) {
        return new Response("slow down", {
          status: 429,
          headers: { "Retry-After": "0" },
        });
      }
      return new Response(
        JSON.stringify({
          objectID: 230,
          title: "Armchair",
          isPublicDomain: true,
          primaryImage: "https://images.metmuseum.org/y.jpg",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const obj = await fetchMetObject(230, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      useCache: false,
      timeoutMs: 2000,
    });
    expect(obj.objectID).toBe(230);
    expect(calls).toBe(2);
  });
});

describe("met cache option (P3-12)", () => {
  it("uses no-store when useCache is false", async () => {
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(init?.cache).toBe("no-store");
      return new Response(
        JSON.stringify({
          objectID: 269,
          title: "Armchair",
          isPublicDomain: true,
          primaryImage: "https://images.metmuseum.org/z.jpg",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    await fetchMetObject(269, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      useCache: false,
      disableRetry: true,
    });
    expect(fetchImpl).toHaveBeenCalled();
  });
});
