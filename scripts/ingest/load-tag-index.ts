/**
 * Load Met CSV tag index into object_tags + term catalog_work_count.
 * No Collection API calls.
 *
 * Usage: npm run ingest:tags
 * Requires: data/met/eligible-ids.json and SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import {
  isLanguageRejected,
  normalizeTermLabel,
  slugifyTerm,
} from "../../src/lib/index/normalize";

config({ path: ".env.local" });

const DATA = path.resolve(process.cwd(), "data/met");
const ELIGIBLE = path.join(DATA, "eligible-ids.json");
const CHUNK = 800;

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

async function main() {
  const raw = JSON.parse(await readFile(ELIGIBLE, "utf8")) as
    | number[]
    | { id: number; tags: string[] }[];
  const rows = raw.map((r) =>
    typeof r === "number" ? { id: r, tags: [] as string[] } : r,
  );

  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tagRows: { source_id: string; slug: string; tag: string }[] = [];
  const seenPair = new Set<string>();
  const bySlug = new Map<
    string,
    { canonical: string; display_label: string; count: number }
  >();

  for (const row of rows) {
    const source_id = String(row.id);
    const used = new Set<string>();
    for (const rawTag of row.tags) {
      const canonical = normalizeTermLabel(rawTag);
      if (!canonical || isLanguageRejected(canonical)) continue;
      const slug = slugifyTerm(canonical);
      if (!slug || used.has(slug)) continue;
      used.add(slug);
      const pair = `${source_id}:${slug}`;
      if (seenPair.has(pair)) continue;
      seenPair.add(pair);
      tagRows.push({ source_id, slug, tag: rawTag });
      const agg = bySlug.get(slug);
      if (agg) agg.count += 1;
      else {
        bySlug.set(slug, {
          canonical,
          display_label: titleCase(canonical),
          count: 1,
        });
      }
    }
  }

  console.log(
    `object_tags rows=${tagRows.length} unique_slugs=${bySlug.size} from ${rows.length} eligible IDs`,
  );

  for (let i = 0; i < tagRows.length; i += CHUNK) {
    const { error } = await supabase
      .from("object_tags")
      .upsert(tagRows.slice(i, i + CHUNK), { onConflict: "source_id,slug" });
    if (error) throw error;
    if (i % 8000 === 0) {
      console.log(`upserted tags ${Math.min(i + CHUNK, tagRows.length)}/${tagRows.length}`);
    }
  }

  const termPayload = [...bySlug.entries()].map(([slug, t]) => ({
    slug,
    canonical: t.canonical,
    display_label: t.display_label,
    catalog_work_count: t.count,
    updated_at: new Date().toISOString(),
  }));

  for (let i = 0; i < termPayload.length; i += 100) {
    const { error } = await supabase
      .from("terms")
      .upsert(termPayload.slice(i, i + 100), { onConflict: "slug" });
    if (error) throw error;
  }

  console.log(`Updated catalog_work_count on ${termPayload.length} terms`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
