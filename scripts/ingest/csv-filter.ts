/**
 * Stream-filter MetObjects.csv → eligible Object IDs (PD + tags + begin date).
 *
 * Usage: npm run ingest:csv-filter
 * Requires: data/met/MetObjects.csv (npm run ingest:download)
 */
import { createReadStream } from "node:fs";
import { mkdir, writeFile, access } from "node:fs/promises";
import path from "node:path";
import { parse } from "csv-parse";

const DATA = path.resolve(process.cwd(), "data/met");
const CSV_PATH = path.join(DATA, "MetObjects.csv");

export type EligibleRow = { id: number; tags: string[] };

function truthy(v: string | undefined): boolean {
  const t = (v ?? "").trim().toLowerCase();
  return t === "true" || t === "1" || t === "yes";
}

function splitTags(raw: string): string[] {
  return raw
    .split("|")
    .map((t) => t.trim())
    .filter(Boolean);
}

async function main() {
  await mkdir(DATA, { recursive: true });
  try {
    await access(CSV_PATH);
  } catch {
    throw new Error(`Missing ${CSV_PATH}. Run: npm run ingest:download`);
  }

  const rowsOut: EligibleRow[] = [];
  let rows = 0;
  let skippedPd = 0;
  let skippedTags = 0;
  let skippedDate = 0;
  let skippedId = 0;

  const parser = createReadStream(CSV_PATH).pipe(
    parse({
      columns: true,
      relax_column_count: true,
      skip_empty_lines: true,
      bom: true,
    }),
  );

  for await (const row of parser as AsyncIterable<Record<string, string>>) {
    rows++;
    if (rows % 50_000 === 0) console.log(`scanned ${rows} rows…`);

    const idRaw = row["Object ID"]?.trim();
    const id = idRaw ? Number(idRaw) : NaN;
    if (!Number.isInteger(id) || id <= 0) {
      skippedId++;
      continue;
    }
    if (!truthy(row["Is Public Domain"])) {
      skippedPd++;
      continue;
    }
    const tags = splitTags(row["Tags"] ?? "");
    if (!tags.length) {
      skippedTags++;
      continue;
    }
    const begin = Number(row["Object Begin Date"]);
    if (!Number.isFinite(begin)) {
      skippedDate++;
      continue;
    }

    rowsOut.push({ id, tags });
  }

  const seen = new Set<number>();
  const unique: EligibleRow[] = [];
  for (const r of rowsOut) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    unique.push(r);
  }

  const summary = {
    rows,
    eligible: unique.length,
    skippedId,
    skippedPd,
    skippedTags,
    skippedDate,
  };

  await writeFile(path.join(DATA, "eligible-ids.json"), JSON.stringify(unique));
  await writeFile(
    path.join(DATA, "csv-filter-summary.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log("Wrote eligible-ids.json", summary);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
