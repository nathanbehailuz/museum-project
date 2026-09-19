import { NextResponse } from "next/server";
import { getArtworkBySourceId, mapArtwork } from "@/lib/aic/queries";

type Params = { params: Promise<{ sourceId: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { sourceId } = await params;
    const row = await getArtworkBySourceId(sourceId);
    if (!row) {
      return NextResponse.json(
        { error: "not_found", message: "Artwork not found in the index." },
        { status: 404 },
      );
    }
    return NextResponse.json({
      artwork: {
        ...mapArtwork(row),
        subjectTitles: row.subject_titles ?? [],
        termTitles: row.term_titles ?? [],
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "index_error", message: "Could not load artwork." },
      { status: 503 },
    );
  }
}
