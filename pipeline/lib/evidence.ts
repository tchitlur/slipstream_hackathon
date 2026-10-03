import { files } from "./paths";
import { readJsonOr, writeJson } from "./io";
import type { Evidence } from "../../src/lib/schemas";

export type EvidenceMap = Record<string, Evidence>;

export function readEvidence(): EvidenceMap {
  return readJsonOr<EvidenceMap>(files.evidence, {});
}

/** Replace all evidence records whose id starts with any of the given prefixes, then add the new ones. Keeps stages idempotent. */
export function writeEvidence(prefixes: string[], records: Evidence[]) {
  const all = readEvidence();
  for (const id of Object.keys(all)) if (prefixes.some((p) => id.startsWith(p))) delete all[id];
  for (const r of records) all[r.id] = r;
  writeJson(files.evidence, all, { pretty: false });
  return all;
}

export function addEvidence(records: Evidence[]) {
  const all = readEvidence();
  for (const r of records) all[r.id] = r;
  writeJson(files.evidence, all, { pretty: false });
  return all;
}
