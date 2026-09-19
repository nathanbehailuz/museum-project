import { NextRequest, NextResponse } from "next/server";
import { EXHIBITION_DEADLINE_MS, fetchArtworkSlots } from "@/lib/met/client";
import { isIdInAnyPublishedPool } from "@/lib/subjects";

export const dynamic = "force-dynamic";

function parseIds(raw: string | null): number[] | null {
  if (!raw || !raw.trim()) return null;
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0 || parts.length > 3) return null;
  const ids: number[] = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const n = Number(part);
    if (!Number.isInteger(n) || n <= 0) return null;
    ids.push(n);
  }
  return ids;
}

export async function GET(request: NextRequest) {
  const ids = parseIds(request.nextUrl.searchParams.get("ids"));
  if (!ids) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_ids",
        message: "Provide 1–3 positive integer IDs via ids=.",
      },
      { status: 400 },
    );
  }

  if (ids.some((id) => !isIdInAnyPublishedPool(id))) {
    return NextResponse.json(
      {
        ok: false,
        error: "ids_not_in_pool",
        message: "One or more IDs are not in a reviewed subject pool.",
      },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXHIBITION_DEADLINE_MS);

  try {
    const { slots } = await fetchArtworkSlots(ids, { signal: controller.signal });
    return NextResponse.json({
      ok: true,
      slots: slots.map((slot) => {
        if (slot.status === "ok") {
          return { id: slot.id, status: "ok", artwork: slot.artwork };
        }
        return { id: slot.id, status: "unavailable", reason: slot.reason };
      }),
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "upstream_error",
        message: "The museum API did not respond in time. Please try again.",
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
