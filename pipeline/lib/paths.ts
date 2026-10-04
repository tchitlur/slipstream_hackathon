import path from "node:path";

export const ROOT = process.cwd();
export const DATA = path.join(ROOT, "data");
export const RAW = path.join(DATA, "raw");
export const DERIVED = path.join(DATA, "derived");
export const SEED = path.join(DATA, "seed");
export const LLM = path.join(DATA, "llm");
export const BRIEFS = path.join(DERIVED, "briefs");
export const TRANSFERS_DIR = path.join(DERIVED, "transfers");

export const files = {
  probe: path.join(DERIVED, "probe.json"),
  atlas: path.join(DERIVED, "atlas.json"),
  phenotypes: path.join(DERIVED, "phenotypes.json"),
  similarity: path.join(DERIVED, "similarity.json"),
  ladders: path.join(DERIVED, "ladders.json"),
  transfers: path.join(DERIVED, "transfers.json"),
  investigators: path.join(DERIVED, "investigators.json"),
  orgs: path.join(DERIVED, "orgs.json"),
  evidence: path.join(DERIVED, "evidence.json"),
  layout: path.join(DERIVED, "layout.json"),
  searchIndex: path.join(DERIVED, "search-index.json"),
  demoCandidates: path.join(DERIVED, "demo_candidates.json"),
  manifest: path.join(DERIVED, "build-manifest.json"),
  baseline: path.join(DERIVED, "baseline.json"),
  registries: path.join(DERIVED, "registries.json"),
  seedSharedRegistries: path.join(SEED, "shared_registries.json"),
  seedOrgRegistryParticipation: path.join(SEED, "org_registry_participation.json"),
  seedExternalRegistries: path.join(SEED, "external_registries.json"),
  seedTargetLevels: path.join(SEED, "study_target_levels.json"),
  studies: path.join(DERIVED, "studies.json"),
  literature: path.join(DERIVED, "literature.json"),
  funding: path.join(DERIVED, "funding.json"),
  reconciliation: path.join(DERIVED, "reconciliation.json"),
  llmCache: path.join(LLM, "cache.jsonl"),
  llmLedger: path.join(LLM, "ledger.json"),
  seedGenes: path.join(SEED, "genes.txt"),
  seedOrgs: path.join(SEED, "patient_orgs.json"),
  seedTherapies: path.join(SEED, "approved_therapies.json"),
};
