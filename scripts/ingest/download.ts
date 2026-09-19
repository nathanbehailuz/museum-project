/**
 * Download AIC getting-started files into data/aic/
 * Sources: https://github.com/art-institute-of-chicago/api-data
 */
import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const ROOT = path.resolve(process.cwd(), "data/aic");
const BASE =
  "https://raw.githubusercontent.com/art-institute-of-chicago/api-data/master/getting-started";

const FILES = ["allArtworks.jsonl", "someArtworks.csv"] as const;

async function download(name: (typeof FILES)[number]) {
  const url = `${BASE}/${name}`;
  const dest = path.join(ROOT, name);
  console.log(`Downloading ${url}`);
  const res = await fetch(url, {
    headers: { "User-Agent": "museum-exhibition/0.1 (getting-started download)" },
  });
  if (!res.ok || !res.body) {
    throw new Error(`Failed ${url}: ${res.status}`);
  }
  await pipeline(Readable.fromWeb(res.body as never), createWriteStream(dest));
  console.log(`Wrote ${dest}`);
}

async function main() {
  await mkdir(ROOT, { recursive: true });
  for (const f of FILES) await download(f);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
