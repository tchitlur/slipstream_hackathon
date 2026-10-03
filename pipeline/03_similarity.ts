/**
 * S3 Similarity: simGIC between every pair of conditions over ancestor-closed phenotype sets.
 * Writes the top 20 neighbors per condition with the five highest-IC shared terms and the
 * share of intersection weight that comes from low-information terms (below the median IC).
 * Cutoffs (edge, high, medium) are percentiles of the observed pairwise distribution.
 */
import { readValidated, writeJson, log } from "./lib/io";
import { files } from "./lib/paths";
import { writeEvidence } from "./lib/evidence";
import { updateManifest } from "./lib/manifest";
import { AtlasSchema, PhenotypesFileSchema, type Neighbor, type Evidence } from "../src/lib/schemas";
import { writeSimilarity } from "./lib/similarityStore";
import { simGIC, closureOf } from "../src/lib/similarity";

const TOP_N = 20;
const SHALLOW_TOP_N = 10;
const SHALLOW_DEEP_N = 5;
const EDGE_PCT = 0.9;
const HIGH_PCT = 0.9;
const MEDIUM_PCT = 0.7;

function percentile(sorted: number[], p: number) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx];
}

async function main() {
  const atlas = readValidated(files.atlas, AtlasSchema);
  const ph = readValidated(files.phenotypes, PhenotypesFileSchema);
  const icOf = (t: string) => ph.terms[t]?.ic ?? 0;
  const parentsOf = (t: string) => ph.terms[t]?.parents ?? [];

  const conds = atlas.conditions.filter((c) => (ph.conditionTerms[c.id] ?? []).length > 0);
  const closures = new Map<string, Set<string>>();
  for (const c of conds) closures.set(c.id, closureOf(ph.conditionTerms[c.id], parentsOf));
  log("S3", `${conds.length} conditions with phenotype sets; computing ${(conds.length * (conds.length - 1)) / 2} pairs`);

  // Pairwise
  const sims: { a: string; b: string; s: number; shared: string[] }[] = [];
  const perCond = new Map<string, { id: string; s: number; shared: string[] }[]>();
  for (const c of conds) perCond.set(c.id, []);
  for (let i = 0; i < conds.length; i++) {
    const a = conds[i];
    const ca = closures.get(a.id)!;
    for (let j = i + 1; j < conds.length; j++) {
      const b = conds[j];
      const cb = closures.get(b.id)!;
      const { sim, shared } = simGIC(ca, cb, icOf);
      if (sim <= 0) continue;
      sims.push({ a: a.id, b: b.id, s: sim, shared });
      perCond.get(a.id)!.push({ id: b.id, s: sim, shared });
      perCond.get(b.id)!.push({ id: a.id, s: sim, shared });
    }
  }
  // Cutoffs are percentiles of the distribution among deep-slice pairs, so they stay stable when the
  // atlas-wide shallow layer (phase 4) is added; the shallow layer would otherwise drag them down.
  const deepIds = new Set(conds.filter((c) => c.depth === "deep").map((c) => c.id));
  const deepPairs = sims.filter((x) => deepIds.has(x.a) && deepIds.has(x.b));
  const sorted = (deepPairs.length >= 100 ? deepPairs : sims).map((x) => x.s).sort((x, y) => x - y);
  const cutoffs = {
    edge: Number(percentile(sorted, EDGE_PCT).toFixed(4)),
    high: Number(percentile(sorted, HIGH_PCT).toFixed(4)),
    medium: Number(percentile(sorted, MEDIUM_PCT).toFixed(4)),
  };
  log("S3", `pairs with sim > 0: ${sims.length} (${deepPairs.length} deep-deep); cutoffs ${JSON.stringify(cutoffs)}; median ${percentile(sorted, 0.5).toFixed(3)}`);

  const geneOf = new Map(atlas.conditions.map((c) => [c.id, c.geneId]));
  const depthOf = new Map(atlas.conditions.map((c) => [c.id, c.depth]));
  const neighbors: Record<string, Neighbor[]> = {};
  for (const c of conds) {
    // Top N overall, plus the top N among deep-slice conditions (which carry full ladders), so the
    // atlas-wide layer never crowds the ladder's rows out of the list.
    const all = perCond.get(c.id)!.sort((x, y) => y.s - x.s);
    const isDeep = c.depth === "deep";
    const list = all.slice(0, isDeep ? TOP_N : SHALLOW_TOP_N);
    for (const n of all.filter((n) => depthOf.get(n.id) === "deep").slice(0, isDeep ? TOP_N : SHALLOW_DEEP_N)) if (!list.includes(n)) list.push(n);
    list.sort((x, y) => y.s - x.s);
    neighbors[c.id] = list.map((n): Neighbor => {
      const sharedSorted = [...n.shared].sort((x, y) => icOf(y) - icOf(x));
      const totalW = n.shared.reduce((acc, t) => acc + icOf(t), 0);
      const lowW = n.shared.filter((t) => icOf(t) < ph.medianIc).reduce((acc, t) => acc + icOf(t), 0);
      const other = atlas.conditions.find((x) => x.id === n.id)!;
      const evidenceIds = ["ev:rule:simgic", ...c.evidenceIds.filter((e) => e.startsWith("ev:hpoa:") || e.startsWith("ev:g2p:")), ...other.evidenceIds.filter((e) => e.startsWith("ev:hpoa:") || e.startsWith("ev:g2p:"))];
      return {
        id: n.id,
        similarity: Number(n.s.toFixed(4)),
        band: n.s >= cutoffs.high ? "high" : n.s >= cutoffs.medium ? "medium" : "low",
        sharedTop: sharedSorted.slice(0, isDeep ? 5 : 3).map((t) => ({ id: t, label: ph.terms[t]?.label ?? t, ic: icOf(t) })),
        lowInfoShare: totalW > 0 ? Number((lowW / totalW).toFixed(3)) : 0,
        sameGene: geneOf.get(n.id) === c.geneId,
        sharedCount: n.shared.length,
        evidenceIds: Array.from(new Set(evidenceIds)),
      };
    });
  }
  for (const c of atlas.conditions) if (!neighbors[c.id]) neighbors[c.id] = [];

  writeSimilarity(cutoffs, neighbors);

  const ev: Evidence[] = [
    {
      id: "ev:rule:simgic",
      kind: "computed",
      source: "rule",
      sourceId: "simGIC",
      url: "/method#similarity",
      retrievedAt: new Date().toISOString().slice(0, 10),
      confidence: "medium",
      title: "Phenotype similarity (simGIC)",
      note: `Information content per HPO term is -log(p), where p is the share of annotated diseases (${ph.annotatedDiseaseCount}) carrying the term or a descendant. Similarity is the summed information content of the shared ancestor-closed terms divided by that of the union. Cutoffs from the observed distribution: high >= ${cutoffs.high}, medium >= ${cutoffs.medium} (percentiles ${HIGH_PCT * 100} and ${MEDIUM_PCT * 100}).`,
    },
  ];
  writeEvidence(["ev:rule:simgic"], ev);
  updateManifest((m) => {
    m.thresholds.similarityEdge = cutoffs.edge;
    m.thresholds.similarityHigh = cutoffs.high;
    m.thresholds.similarityMedium = cutoffs.medium;
    m.thresholds.similarityEdgePercentile = EDGE_PCT;
    m.thresholds.similarityHighPercentile = HIGH_PCT;
    m.thresholds.similarityMediumPercentile = MEDIUM_PCT;
    m.counts.similarityPairs = sims.length;
    m.counts.conditionsWithPhenotypes = conds.length;
  });
  const sample = conds.find((c) => c.geneSymbol === "SCN1A") ?? conds[0];
  log("S3", `${sample.name}: ${neighbors[sample.id].slice(0, 5).map((n) => `${atlas.conditions.find((c) => c.id === n.id)?.geneSymbol}=${n.similarity}`).join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
