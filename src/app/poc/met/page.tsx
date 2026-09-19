import { createSupabaseServerClient } from "@/lib/supabase/server";
import styles from "./met-poc.module.css";

export const dynamic = "force-dynamic";

type Row = {
  source_id: string;
  title: string | null;
  artist_title: string | null;
  date_display: string | null;
  image_id: string | null;
  source_url: string | null;
};

export default async function MetPocPage() {
  let rows: Row[] = [];
  let error: string | null = null;

  try {
    const supabase = createSupabaseServerClient();
    const { data, error: qErr } = await supabase
      .from("artworks")
      .select(
        "source_id, title, artist_title, date_display, image_id, source_url",
      )
      .eq("source", "met")
      .eq("is_public_domain", true)
      .order("updated_at", { ascending: false })
      .limit(24);
    if (qErr) throw qErr;
    rows = (data ?? []) as Row[];
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load";
  }

  return (
    <main className={styles.page}>
      <p className={styles.eyebrow}>Throwaway POC</p>
      <h1 className={styles.title}>Met Collection smoke test</h1>
      <p className={styles.lede}>
        Public-domain works from the Met API (<code>/v1.1/search</code>), stored
        in <code>artworks</code> with <code>source=met</code>. Images are direct
        JPEGs on <code>images.metmuseum.org</code> (confirmed HTTP 200) — not AIC
        IIIF.
      </p>

      {error && <p className={styles.error}>{error}</p>}
      {!error && rows.length === 0 && (
        <p className={styles.muted}>
          No Met rows yet. Run <code>npx tsx scripts/poc/met-seed.ts</code>.
        </p>
      )}

      <div className={styles.grid}>
        {rows.map((row) => (
          <figure key={row.source_id} className={styles.card}>
            {row.image_id ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={row.image_id} alt={row.title || "Artwork"} />
            ) : (
              <div className={styles.fallback}>No image</div>
            )}
            <figcaption>
              <strong>{row.title || "Untitled"}</strong>
              <span>
                {row.artist_title || "Artist unknown"}
                {row.date_display ? ` · ${row.date_display}` : ""}
              </span>
              {row.source_url && (
                <a href={row.source_url} target="_blank" rel="noreferrer">
                  Met object page
                </a>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}
