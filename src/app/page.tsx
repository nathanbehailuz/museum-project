import { Suspense } from "react";
import Link from "next/link";
import SubjectSearch from "./components/SubjectSearch";
import HomeCatalogGraph from "./components/HomeCatalogGraph";
import ArtworkImage from "./components/ArtworkImage";
import styles from "./components/museum.module.css";
import {
  getArtworksByIds,
  getCatalogGraph,
  getTermBySlug,
  mapArtwork,
  mapTerm,
  suggestJourneyReady,
} from "@/lib/aic/queries";
import { formatDateDisplay, formatSubjectMeta, formatYear } from "@/lib/formatDate";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { subjectPath } from "@/lib/subjectUrlState";
import type { ArtworkCard, CatalogGraphEdge, CatalogGraphNode, SubjectSummary } from "@/lib/aic/apiTypes";

const FEATURED_SLUG = "flower";

async function loadFeaturedWorks(termId: string, limit = 6): Promise<ArtworkCard[]> {
  const supabase = createSupabaseServerClient();
  const { data: periods } = await supabase
    .from("term_periods")
    .select("featured_artwork_ids")
    .eq("term_id", termId)
    .order("period_index", { ascending: true });

  const ids: string[] = [];
  const seen = new Set<string>();
  for (const p of periods ?? []) {
    for (const id of (p.featured_artwork_ids as string[]) ?? []) {
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      if (ids.length >= limit) break;
    }
    if (ids.length >= limit) break;
  }
  const rows = await getArtworksByIds(ids);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((r) => mapArtwork(r!));
}

function MiniTimeline({ works }: { works: ArtworkCard[] }) {
  return (
    <div className={styles.miniTimeline}>
      <svg className={styles.miniTimelineSvg} aria-hidden="true">
        <line
          x1="4%"
          y1="42%"
          x2="96%"
          y2="42%"
          stroke="rgba(242,202,80,0.35)"
          strokeWidth="1"
          strokeDasharray="4 4"
        />
      </svg>
      {works.slice(0, 4).map((w) => (
        <figure key={w.sourceId} className={styles.miniNode}>
          <div className={styles.miniThumb}>
            <ArtworkImage
              src={w.imageUrl}
              alt={w.altText || w.title || "Artwork"}
              width={w.imageWidth}
              height={w.imageHeight}
            />
            <span className={styles.homeAmbientDate}>
              {w.dateStart != null
                ? formatYear(w.dateStart)
                : formatDateDisplay(w.dateDisplay).slice(0, 10)}
            </span>
          </div>
          <figcaption>{w.title || "Untitled"}</figcaption>
        </figure>
      ))}
    </div>
  );
}

function SubjectRows({ subjects }: { subjects: SubjectSummary[] }) {
  if (!subjects.length) return null;
  return (
    <section className={styles.subjectRows} aria-labelledby="start-subjects">
      <h2 id="start-subjects" className={styles.sectionHeading}>
        Start with a subject
      </h2>
      <ul className={styles.subjectRowList}>
        {subjects.map((s) => (
          <li key={s.slug} className={styles.subjectRow}>
            <Link
              href={subjectPath(s.slug, "journey")}
              className={styles.subjectRowMain}
            >
              <span className={styles.subjectRowLabel}>{s.displayLabel}</span>
              <span className={styles.subjectRowMeta}>
                {formatSubjectMeta(
                  s.qualifyingWorkCount,
                  s.dateMin,
                  s.dateMax,
                )}
              </span>
            </Link>
            <Link
              href={subjectPath(s.slug, "connections")}
              className={styles.subjectRowConn}
              title={`Connections for ${s.displayLabel}`}
              aria-label={`Open connections for ${s.displayLabel}`}
            >
              ◎
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

async function HomeBody() {
  let featuredTerm = null as Awaited<ReturnType<typeof getTermBySlug>>;
  let featuredWorks: ArtworkCard[] = [];
  let subjects: SubjectSummary[] = [];
  let graphNodes: CatalogGraphNode[] = [];
  let graphEdges: CatalogGraphEdge[] = [];

  try {
    featuredTerm = await getTermBySlug(FEATURED_SLUG);
    if (featuredTerm?.status === "journey_ready") {
      featuredWorks = await loadFeaturedWorks(featuredTerm.id, 6);
    }
    subjects = (await suggestJourneyReady(6)).map(mapTerm);
    const graph = await getCatalogGraph();
    graphNodes = graph.nodes;
    graphEdges = graph.edges;
  } catch {
    return (
      <p className={styles.muted}>
        Index unavailable — check Supabase env vars.
      </p>
    );
  }

  const featured = featuredTerm ? mapTerm(featuredTerm) : null;

  return (
    <>
      <div className={styles.homeHero}>
        <p className={styles.eyebrow}>The Metropolitan Museum of Art</p>
        <h1 className={styles.brand}>The Met Archive</h1>
        <p className={styles.searchPrompt}>What do you want to find in art?</p>
        <p className={styles.lede}>
          Search an everyday subject to follow it through time and discover what
          surrounds it.
        </p>
        <Suspense fallback={<p className={styles.muted}>Loading search…</p>}>
          <SubjectSearch />
        </Suspense>
      </div>

      {graphNodes.length > 0 && (
        <HomeCatalogGraph nodes={graphNodes} edges={graphEdges} />
      )}

      {featured && (
        <section
          className={styles.featuredSubject}
          aria-labelledby="featured-heading"
        >
          <p className={styles.eyebrow}>Subject from the archive</p>
          <h2 id="featured-heading" className={styles.featuredTitle}>
            {featured.displayLabel}
          </h2>
          <p className={styles.muted}>
            {formatSubjectMeta(
              featured.qualifyingWorkCount,
              featured.dateMin,
              featured.dateMax,
            )}
          </p>
          <p className={styles.catalogNote}>
            Catalog subject — works tagged with this motif in The Met collection,
            including decorative and applied arts.
          </p>
          {featuredWorks.length > 0 && (
            <MiniTimeline works={featuredWorks.slice(0, 4)} />
          )}
          <div className={styles.ctaRow}>
            <Link
              href={subjectPath(featured.slug, "journey")}
              className={`${styles.button} ${styles.buttonPrimary}`}
            >
              Enter Journey
            </Link>
            <Link
              href={subjectPath(featured.slug, "connections")}
              className={styles.button}
            >
              Explore Connections
            </Link>
          </div>
        </section>
      )}

      <SubjectRows subjects={subjects} />

      <p className={styles.provenance}>
        Built from The Met Open Access collection. Subjects and relationships
        come from museum catalog tags.
      </p>
    </>
  );
}

export default function HomePage() {
  return (
    <main className={styles.page}>
      <div className={`${styles.pageInner} ${styles.homePage}`}>
        <Suspense fallback={<p className={styles.muted}>Loading…</p>}>
          <HomeBody />
        </Suspense>
      </div>
    </main>
  );
}
