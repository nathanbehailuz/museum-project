import { NextRequest, NextResponse } from "next/server";
import { EXHIBITION_DEADLINE_MS, fetchMetObject } from "@/lib/met/client";
import { normalizeMetObject } from "@/lib/met/normalize";
import { getSubjectOrNull, pickReplacementId } from "@/lib/subjects";

export const dynamic = "force-dynamic";

function parseExclude(raw: string | null): number[] {
  if (!raw || !raw.trim()) return [];
  const ids: number[] = [];
  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    if (!/^\d+$/.test(trimmed)) continue;
    const n = Number(trimmed);
    if (Number.isInteger(n) && n > 0) ids.push(n);
  }
  return ids;
}

export async function GET(request: NextRequest) {
  const subject = getSubjectOrNull(request.nextUrl.searchParams.get("subject"));
  if (!subject) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_subject",
        message: "Unsupported or missing subject.",
      },
      { status: 400 },
    );
  }

  const exclude = parseExclude(request.nextUrl.searchParams.get("exclude"));
  if (exclude.length > 3) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_exclude",
        message: "At most three IDs may be excluded.",
      },
      { status: 400 },
    );
  }

  const candidates = subject.artworkIds.filter((id) => !exclude.includes(id));
  if (candidates.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "exhausted_pool",
        message: "No replacement artworks remain for this subject.",
      },
      { status: 404 },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXHIBITION_DEADLINE_MS);

  try {
    // Try candidates in pool order until one normalizes as eligible.
    for (const id of candidates) {
      if (controller.signal.aborted) break;
      try {
        const obj = await fetchMetObject(id, { signal: controller.signal });
        const artwork = normalizeMetObject(obj);
        if (artwork) {
          return NextResponse.json({ ok: true, artwork });
        }
      } catch {
        // try next candidate
      }
    }

    // Config said there was a pick, but none were eligible upstream.
    const fallbackId = pickReplacementId(subject, exclude);
    return NextResponse.json(
      {
        ok: false,
        error: fallbackId == null ? "exhausted_pool" : "upstream_error",
        message:
          fallbackId == null
            ? "No replacement artworks remain for this subject."
            : "Could not load a replacement from the museum. Please try again.",
      },
      { status: fallbackId == null ? 404 : 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
