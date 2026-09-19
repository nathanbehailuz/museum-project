import { NextResponse } from "next/server";
import { getTermBySlug, mapArtwork, mapTerm } from "@/lib/aic/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ slug: string }> };

const PAGE_SIZE = 24;

export async function GET(request: Request, { params }: Params) {
  try {
    const { slug } = await params;
    const term = await getTermBySlug(slug);
    if (!term || term.status === "unavailable") {
      return NextResponse.json(
        { error: "not_found", message: "Subject not found." },
        { status: 404 },
      );
    }

    const { searchParams } = new URL(request.url);
    const sort = searchParams.get("sort") ?? "date";
    const type = searchParams.get("type");
    const medium = searchParams.get("medium");
    const artist = searchParams.get("artist");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);

    const supabase = createSupabaseServerClient();
    const { data: links, error: linkErr } = await supabase
      .from("artwork_terms")
      .select("artwork_id, evidence_source, relevance_weight")
      .eq("term_id", term.id)
      .in("evidence_source", ["subject", "term"]);
    if (linkErr) throw linkErr;

    const evidenceByArtwork = new Map<string, string>();
    const artworkIds = [
      ...new Set(
        (links ?? []).map((l) => {
          evidenceByArtwork.set(
            l.artwork_id as string,
            l.evidence_source as string,
          );
          return l.artwork_id as string;
        }),
      ),
    ];

    if (!artworkIds.length) {
      return NextResponse.json({
        subject: mapTerm(term),
        results: [],
        page,
        pageSize: PAGE_SIZE,
        total: 0,
      });
    }

    let query = supabase
      .from("artworks")
      .select(
        "id, source_id, title, artist_title, date_display, date_start, medium_display, artwork_type_title, image_id, image_width, image_height, alt_text, source_url",
        { count: "exact" },
      )
      .in("id", artworkIds)
      .eq("is_public_domain", true)
      .not("image_id", "is", null)
      .not("date_start", "is", null);

    if (type) query = query.ilike("artwork_type_title", `%${type}%`);
    if (medium) query = query.ilike("medium_display", `%${medium}%`);
    if (artist) query = query.ilike("artist_title", `%${artist}%`);
    if (from) query = query.gte("date_start", Number(from));
    if (to) query = query.lte("date_start", Number(to));

    if (sort === "title") query = query.order("title", { ascending: true });
    else if (sort === "artist")
      query = query.order("artist_title", { ascending: true });
    else query = query.order("date_start", { ascending: true });

    const fromIdx = (page - 1) * PAGE_SIZE;
    const { data, error, count } = await query.range(
      fromIdx,
      fromIdx + PAGE_SIZE - 1,
    );
    if (error) throw error;

    const results = (data ?? []).map((row) =>
      mapArtwork(row, evidenceByArtwork.get(row.id) ?? null),
    );

    return NextResponse.json({
      subject: mapTerm(term),
      results,
      page,
      pageSize: PAGE_SIZE,
      total: count ?? results.length,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "index_error", message: "Could not load works." },
      { status: 503 },
    );
  }
}
