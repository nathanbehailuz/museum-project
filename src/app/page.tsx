import { Suspense } from "react";
import Link from "next/link";
import SubjectSearch from "./components/SubjectSearch";
import ArtworkImage from "./components/ArtworkImage";
import styles from "./components/museum.module.css";
import { getTermBySlug, getArtworksByIds, mapArtwork } from "@/lib/aic/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { subjectPath } from "@/lib/subjectUrlState";

async function FlowerTeaser() {
  try {
    const term = await getTermBySlug("flower");
    if (!term || term.status !== "journey_ready") return null;

    const supabase = createSupabaseServerClient();
    const { data: periods } = await supabase
      .from("term_periods")
      .select("featured_artwork_ids, label")
      .eq("term_id", term.id)
      .order("period_index", { ascending: true })
      .limit(3);

    const ids = [
      ...new Set(
        (periods ?? []).flatMap(
          (p) => ((p.featured_artwork_ids as string[]) ?? []).slice(0, 1),
        ),
      ),
    ].slice(0, 3);
    const rows = await getArtworksByIds(ids);
    const works = rows.map((r) => mapArtwork(r));

    return (
      <section className={styles.teaser} aria-labelledby="teaser-heading">
        <p className={styles.eyebrow}>Start here</p>
        <h2 id="teaser-heading" className={styles.chapterLabel}>
          Flower across time
        </h2>
        <p className={styles.muted}>
          A chronological constellation of {term.qualifying_work_count} works
          {term.date_min != null && term.date_max != null
            ? ` spanning ${term.date_min}–${term.date_max}`
            : ""}
          .
        </p>
        <div className={styles.teaserGrid}>
          {works.map((w) => (
            <figure key={w.sourceId} className={styles.teaserCard}>
              <ArtworkImage
                src={w.imageUrl}
                alt={w.altText || w.title || "Artwork"}
                width={w.imageWidth}
                height={w.imageHeight}
              />
              <figcaption>{w.title || "Untitled"}</figcaption>
            </figure>
          ))}
        </div>
        <Link
          href={subjectPath("flower", "journey")}
          className={`${styles.button} ${styles.buttonPrimary}`}
        >
          Open chronological journey
        </Link>
      </section>
    );
  } catch {
    return (
      <p className={styles.muted}>
        Index unavailable — check Supabase env vars.
      </p>
    );
  }
}

export default function HomePage() {
  return (
    <main className={styles.page}>
      <div className={styles.pageInner}>
        <p className={styles.eyebrow}>The Metropolitan Museum of Art</p>
        <h1 className={styles.brand}>Subject museum</h1>
        <p className={styles.lede}>
          Type a thing. See how artists have pictured it across time — then
          explore what else in the catalog shares its company.
        </p>
        <Suspense fallback={<p className={styles.muted}>Loading search…</p>}>
          <SubjectSearch autofocus />
        </Suspense>
        <Suspense fallback={null}>
          <FlowerTeaser />
        </Suspense>
      </div>
    </main>
  );
}
