import { NextResponse } from "next/server";
import {
  getTermBySlug,
  mapTerm,
  suggestJourneyReady,
} from "@/lib/aic/queries";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const term = await getTermBySlug(slug);
    if (!term) {
      const suggestions = (await suggestJourneyReady(6)).map(mapTerm);
      return NextResponse.json(
        {
          error: "not_found",
          message: `No subject named “${slug}” in the index.`,
          suggestions,
        },
        { status: 404 },
      );
    }

    const summary = mapTerm(term);
    if (term.status === "unavailable") {
      const suggestions = (await suggestJourneyReady(6)).map(mapTerm);
      return NextResponse.json(
        {
          error: "unavailable",
          message:
            summary.validationReasons.join("; ") ||
            "This subject does not have enough displayable works for a journey.",
          subject: summary,
          suggestions,
        },
        { status: 404 },
      );
    }

    return NextResponse.json({ subject: summary });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "index_error", message: "Could not load this subject." },
      { status: 503 },
    );
  }
}
