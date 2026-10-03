import fs from "node:fs";
import path from "node:path";
import { files, DERIVED } from "./paths";
import { readJson, writeJson, ensureDir } from "./io";
import type { SimilarityFile, Neighbor } from "../../src/lib/schemas";

export const SIMILARITY_DIR = path.join(DERIVED, "similarity");

export type SimilarityIndex = { cutoffs: NonNullable<SimilarityFile["cutoffs"]>; conditionIds: string[] };

/** Write the per-condition neighbor files plus a small index (cutoffs and ids). */
export function writeSimilarity(cutoffs: SimilarityIndex["cutoffs"], neighbors: Record<string, Neighbor[]>) {
  if (fs.existsSync(SIMILARITY_DIR)) fs.rmSync(SIMILARITY_DIR, { recursive: true });
  ensureDir(SIMILARITY_DIR);
  for (const [cid, list] of Object.entries(neighbors)) writeJson(path.join(SIMILARITY_DIR, `${cid.replace(/^cond:/, "")}.json`), { conditionId: cid, neighbors: list }, { pretty: false });
  writeJson(files.similarity, { cutoffs, conditionIds: Object.keys(neighbors) } satisfies SimilarityIndex);
}

export function readSimilarityIndex(): SimilarityIndex {
  return readJson<SimilarityIndex>(files.similarity);
}

export function readNeighbors(cid: string): Neighbor[] {
  const p = path.join(SIMILARITY_DIR, `${cid.replace(/^cond:/, "")}.json`);
  return fs.existsSync(p) ? readJson<{ neighbors: Neighbor[] }>(p).neighbors : [];
}

export function readAllNeighbors(): Record<string, Neighbor[]> {
  const idx = readSimilarityIndex();
  const out: Record<string, Neighbor[]> = {};
  for (const cid of idx.conditionIds) out[cid] = readNeighbors(cid);
  return out;
}
