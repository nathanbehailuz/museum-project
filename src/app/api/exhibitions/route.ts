import { NextRequest, NextResponse } from "next/server";
import { loadExhibition } from "@/lib/exhibitions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const subject = request.nextUrl.searchParams.get("subject");
  const result = await loadExhibition(subject);

  if (!result.ok) {
    const status =
      result.error === "invalid_subject"
        ? 400
        : result.error === "insufficient_content"
          ? 404
          : 502;
    return NextResponse.json(result, { status });
  }

  return NextResponse.json(result);
}
