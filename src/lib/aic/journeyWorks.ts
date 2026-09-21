import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ArtworkCard,
  JourneyIngestionProgress,
  JourneyWorksResponse,
} from "./apiTypes";
import { mapArtwork } from "./queries";
import { createSupabaseAdminClient } from "../supabase/admin";
import { createSupabaseServerClient } from "../supabase/server";
import { CATALOG_EVIDENCE } from "../index/enrichIds";

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 5000;
const QUERY_PAGE_SIZE = 1000;

type JoinedArtwork = Parameters<typeof mapArtwork>[0] & {
  id: string;
  updated_at: string;
  is_public_domain: boolean;
};

type JoinedLink = {
  evidence_source: string;
  artworks: JoinedArtwork | JoinedArtwork[] | null;
};

function joinedArtwork(link: JoinedLink): JoinedArtwork | null {
  if (Array.isArray(link.artworks)) return link.artworks[0] ?? null;
  return link.artworks;
}

async function latestIngestionProgress(
  slug: string,
): Promise<JourneyIngestionProgress | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("ingestion_runs")
    .select("started_at, finished_at, notes, error_summary")
    .eq("source_version", `api-subject-bulk:${slug}`)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;

  let notes: Record<string, unknown> = {};
  try {
    notes = JSON.parse((data.notes as string | null) ?? "{}") as Record<
      string,
      unknown
    >;
  } catch {
    notes = {};
  }
  const status =
    typeof notes.status === "string"
      ? notes.status
      : data.finished_at
        ? "complete"
        : "running";
  return {
    status:
      status === "complete" ||
      status === "retry_required" ||
      status === "running"
        ? status
        : "running",
    processed:
      typeof notes.processed === "number" ? notes.processed : 0,
    total: typeof notes.total === "number" ? notes.total : 0,
    failed: typeof notes.failed === "number" ? notes.failed : 0,
    startedAt: data.started_at as string,
    finishedAt: (data.finished_at as string | null) ?? null,
    error: (data.error_summary as string | null) ?? null,
  };
}

export async function getJourneyWorksPage(options: {
  termId: string;
  slug: string;
  catalogCount: number;
  page?: number;
  pageSize?: number;
  fromYear?: number | null;
  toYear?: number | null;
  updatedAfter?: string | null;
  supabase?: SupabaseClient;
}): Promise<JourneyWorksResponse> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, options.pageSize ?? DEFAULT_PAGE_SIZE),
  );
  const serverTime = new Date().toISOString();
  const supabase = options.supabase ?? createSupabaseServerClient();

  const links: JoinedLink[] = [];
  for (let from = 0; ; from += QUERY_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("artwork_terms")
      .select(
        `
          evidence_source,
          artworks!inner (
            id,
            source_id,
            title,
            artist_title,
            date_display,
            date_start,
            medium_display,
            artwork_type_title,
            image_id,
            image_url,
            image_url_small,
            image_width,
            image_height,
            alt_text,
            source_url,
            updated_at,
            is_public_domain
          )
        `,
      )
      .eq("term_id", options.termId)
      .in("evidence_source", [...CATALOG_EVIDENCE])
      .range(from, from + QUERY_PAGE_SIZE - 1);
    if (error) throw error;
    const batch = (data ?? []) as unknown as JoinedLink[];
    links.push(...batch);
    if (batch.length < QUERY_PAGE_SIZE) break;
  }

  const bySourceId = new Map<string, ArtworkCard>();
  for (const link of links) {
    const artwork = joinedArtwork(link);
    if (
      !artwork ||
      !artwork.is_public_domain ||
      artwork.date_start == null ||
      !(artwork.image_url_small || artwork.image_url || artwork.image_id) ||
      (options.fromYear != null && artwork.date_start < options.fromYear) ||
      (options.toYear != null && artwork.date_start > options.toYear) ||
      (options.updatedAfter &&
        new Date(artwork.updated_at).getTime() <=
          new Date(options.updatedAfter).getTime())
    ) {
      continue;
    }
    bySourceId.set(
      artwork.source_id,
      mapArtwork(artwork, link.evidence_source),
    );
  }

  const allWorks = [...bySourceId.values()].sort(
    (a, b) =>
      (a.dateStart ?? Number.POSITIVE_INFINITY) -
        (b.dateStart ?? Number.POSITIVE_INFINITY) ||
      a.sourceId.localeCompare(b.sourceId),
  );
  const fromIndex = (page - 1) * pageSize;
  const works = allWorks.slice(fromIndex, fromIndex + pageSize);

  return {
    works,
    page,
    pageSize,
    total: allWorks.length,
    catalogCount: options.catalogCount,
    serverTime,
    ingestion: await latestIngestionProgress(options.slug),
  };
}
