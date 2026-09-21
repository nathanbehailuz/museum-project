import { NextResponse } from "next/server";
import { getTermBySlug } from "@/lib/aic/queries";
import { getJourneyWorksPage } from "@/lib/aic/journeyWorks";

type Params = { params: Promise<{ slug: string }> };

export const maxDuration = 60;

function optionalNumber(value: string | null): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const term = await getTermBySlug(slug);
    if (!term) {
      return NextResponse.json(
        { error: "not_found", message: "Subject not found." },
        { status: 404 },
      );
    }

    const search = new URL(request.url).searchParams;
    const page = Math.max(1, Number(search.get("page") ?? "1") || 1);
    const pageSize = Math.max(
      1,
      Number(search.get("pageSize") ?? "100") || 100,
    );
    const updatedAfterRaw = search.get("updatedAfter");
    const updatedAfter =
      updatedAfterRaw && !Number.isNaN(Date.parse(updatedAfterRaw))
        ? updatedAfterRaw
        : null;

    const result = await getJourneyWorksPage({
      termId: term.id,
      slug,
      catalogCount: term.catalog_work_count ?? 0,
      page,
      pageSize,
      fromYear: optionalNumber(search.get("from")),
      toYear: optionalNumber(search.get("to")),
      updatedAfter,
    });
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "index_error", message: "Could not load journey works." },
      { status: 503 },
    );
  }
}
