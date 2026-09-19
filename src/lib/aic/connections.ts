import { isGenericCanonical } from "./normalize";

export type TermMeta = {
  id: string;
  canonical: string;
  slug: string;
  aliases: string[];
  status: "journey_ready" | "browse_only" | "unavailable";
};

export type ArtworkTermLink = {
  artwork_id: string;
  term_id: string;
  evidence_source: string;
};

export type ConnectionEdge = {
  source_term_id: string;
  target_term_id: string;
  shared_work_count: number;
  connection_score: number;
  sample_artwork_ids: string[];
};

const MIN_SHARED = 3;
const SAMPLE_CAP = 5;
const TOP_K = 8;

export function connectionScore(
  shared: number,
  countA: number,
  countB: number,
): number {
  if (shared <= 0 || countA <= 0 || countB <= 0) return 0;
  return shared / Math.sqrt(countA * countB);
}

function isAliasPair(a: TermMeta, b: TermMeta): boolean {
  if (a.canonical === b.canonical || a.slug === b.slug) return true;
  if (a.aliases.includes(b.canonical) || b.aliases.includes(a.canonical)) {
    return true;
  }
  if (a.aliases.includes(b.slug) || b.aliases.includes(a.slug)) return true;
  return false;
}

function eligibleTarget(term: TermMeta): boolean {
  if (isGenericCanonical(term.canonical)) return false;
  if (term.status === "unavailable") return false;
  return true;
}

/**
 * Compute directed top-K co-occurrence edges for every journey_ready source.
 * Only catalog evidence links (subject/term) on qualifying artwork IDs.
 */
export function computeConnections(input: {
  terms: TermMeta[];
  /** artwork_id → term_ids present via subject/term evidence */
  artworkTermSets: Map<string, Set<string>>;
  topK?: number;
  minShared?: number;
}): ConnectionEdge[] {
  const topK = input.topK ?? TOP_K;
  const minShared = input.minShared ?? MIN_SHARED;
  const byId = new Map(input.terms.map((t) => [t.id, t]));

  const termCounts = new Map<string, number>();
  for (const set of input.artworkTermSets.values()) {
    for (const tid of set) {
      termCounts.set(tid, (termCounts.get(tid) ?? 0) + 1);
    }
  }

  type PairAgg = { shared: number; samples: string[] };
  const pairs = new Map<string, PairAgg>();

  for (const [artworkId, termSet] of input.artworkTermSets) {
    const ids = [...termSet].sort();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]!;
        const b = ids[j]!;
        const key = `${a}|${b}`;
        let agg = pairs.get(key);
        if (!agg) {
          agg = { shared: 0, samples: [] };
          pairs.set(key, agg);
        }
        agg.shared += 1;
        if (agg.samples.length < SAMPLE_CAP) agg.samples.push(artworkId);
      }
    }
  }

  const undirected: ConnectionEdge[] = [];
  for (const [key, agg] of pairs) {
    if (agg.shared < minShared) continue;
    const [aId, bId] = key.split("|") as [string, string];
    const a = byId.get(aId);
    const b = byId.get(bId);
    if (!a || !b) continue;
    if (!eligibleTarget(a) || !eligibleTarget(b)) continue;
    if (isAliasPair(a, b)) continue;
    const score = connectionScore(
      agg.shared,
      termCounts.get(aId) ?? 0,
      termCounts.get(bId) ?? 0,
    );
    undirected.push({
      source_term_id: aId,
      target_term_id: bId,
      shared_work_count: agg.shared,
      connection_score: score,
      sample_artwork_ids: [...agg.samples],
    });
  }

  // Directed top-K from each journey_ready source
  const bySource = new Map<string, ConnectionEdge[]>();
  for (const edge of undirected) {
    const push = (source: string, target: string) => {
      const src = byId.get(source);
      if (!src || src.status !== "journey_ready") return;
      const tgt = byId.get(target);
      if (!tgt || !eligibleTarget(tgt)) return;
      const list = bySource.get(source) ?? [];
      list.push({
        source_term_id: source,
        target_term_id: target,
        shared_work_count: edge.shared_work_count,
        connection_score: edge.connection_score,
        sample_artwork_ids: edge.sample_artwork_ids,
      });
      bySource.set(source, list);
    };
    push(edge.source_term_id, edge.target_term_id);
    push(edge.target_term_id, edge.source_term_id);
  }

  const out: ConnectionEdge[] = [];
  for (const [, list] of bySource) {
    list.sort((x, y) => y.connection_score - x.connection_score);
    out.push(...list.slice(0, topK));
  }
  return out;
}
