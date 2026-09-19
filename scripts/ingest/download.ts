/**
 * Download Met Open Access CSV (optional bulk). Large file.
 * https://github.com/metmuseum/openaccess
 */
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const OUT_DIR = path.resolve(process.cwd(), "data/met");
const CSV_URL =
  process.env.MET_CSV_URL ??
  "https://media.githubusercontent.com/media/metmuseum/openaccess/master/MetObjects.csv";

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const dest = path.join(OUT_DIR, "MetObjects.csv");
  console.log("Fetching", CSV_URL);
  const res = await fetch(CSV_URL, {
    headers: { "User-Agent": "museum-exhibition-met-ingest/1.0" },
  });
  if (!res.ok || !res.body) throw new Error(`Download failed: ${res.status}`);
  // @ts-expect-error Node fetch body
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
  console.log("Wrote", dest);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
