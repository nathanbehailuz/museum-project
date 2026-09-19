import { NextResponse } from "next/server";
import { mapTerm, searchTerms } from "@/lib/aic/queries";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") ?? "";
    const rows = await searchTerms(q, 12);
    return NextResponse.json({
      results: rows.map(mapTerm),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "index_error", message: "Could not search the subject index." },
      { status: 503 },
    );
  }
}
