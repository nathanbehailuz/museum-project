import { NextResponse } from "next/server";
import {
  getArtworksByIds,
  getTermBySlug,
  mapArtwork,
  mapTerm,
} from "@/lib/aic/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const term = await getTermBySlug(slug);
    if (!term || term.status === "unavailable") {
      return NextResponse.json(
        { error: "not_found", message: "Subject not available for a journey." },
        { status: 404 },
      );
    }
    if (term.status === "browse_only") {
      return NextResponse.json(
        {
          error: "unavailable",
          message:
            "This subject is browse-only — not enough temporal breadth or depth for a chronological journey.",
          subject: mapTerm(term),
        },
        { status: 404 },
      );
    }

    const supabase = createSupabaseServerClient();
    const { data: periods, error } = await supabase
      .from("term_periods")
      .select(
        "period_index, label, begin_year, end_year, work_count, featured_artwork_ids",
      )
      .eq("term_id", term.id)
      .order("period_index", { ascending: true });
    if (error) throw error;

    const allFeaturedIds = [
      ...new Set(
        (periods ?? []).flatMap(
          (p) => (p.featured_artwork_ids as string[]) ?? [],
        ),
      ),
    ];
    const artworks = await getArtworksByIds(allFeaturedIds);
    const byId = new Map(artworks.map((a) => [a.id, a]));

    const chapters = (periods ?? []).map((p) => {
      const ids = (p.featured_artwork_ids as string[]) ?? [];
      return {
        periodIndex: p.period_index as number,
        label: p.label as string,
        beginYear: p.begin_year as number | null,
        endYear: p.end_year as number | null,
        workCount: p.work_count as number,
        featured: ids
          .map((id) => byId.get(id))
          .filter(Boolean)
          .map((row) => mapArtwork(row!)),
      };
    });

    return NextResponse.json({
      subject: mapTerm(term),
      chapters,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "index_error", message: "Could not load journey chapters." },
      { status: 503 },
    );
  }
}
