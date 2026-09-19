import WorksView from "@/app/components/WorksView";
import styles from "@/app/components/museum.module.css";
import { getTermBySlug, mapArtwork } from "@/lib/aic/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { parseSubjectSearchParams } from "@/lib/subjectUrlState";

const PAGE_SIZE = 24;

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WorksPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === "string") qs.set(k, v);
  }
  const state = parseSubjectSearchParams(qs);

  const term = await getTermBySlug(slug);
  if (!term) {
    return <p className={styles.error}>Subject not found.</p>;
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data: links, error: linkErr } = await supabase
      .from("artwork_terms")
      .select("artwork_id, evidence_source")
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
      return (
        <WorksView results={[]} page={1} pageSize={PAGE_SIZE} total={0} />
      );
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

    if (state.type) query = query.ilike("artwork_type_title", `%${state.type}%`);
    if (state.medium)
      query = query.ilike("medium_display", `%${state.medium}%`);
    if (state.artist) query = query.ilike("artist_title", `%${state.artist}%`);
    if (state.from != null) query = query.gte("date_start", state.from);
    if (state.to != null) query = query.lte("date_start", state.to);

    if (state.sort === "title")
      query = query.order("title", { ascending: true });
    else if (state.sort === "artist")
      query = query.order("artist_title", { ascending: true });
    else query = query.order("date_start", { ascending: true });

    const fromIdx = (state.page - 1) * PAGE_SIZE;
    const { data, error, count } = await query.range(
      fromIdx,
      fromIdx + PAGE_SIZE - 1,
    );
    if (error) throw error;

    const results = (data ?? []).map((row) =>
      mapArtwork(row, evidenceByArtwork.get(row.id) ?? null),
    );

    return (
      <WorksView
        results={results}
        page={state.page}
        pageSize={PAGE_SIZE}
        total={count ?? results.length}
      />
    );
  } catch {
    return (
      <p className={styles.error}>
        Could not load works. The index may be temporarily unavailable.
      </p>
    );
  }
}
