import "server-only";
import fs from "node:fs";
import path from "node:path";
import type {
  Atlas,
  Condition,
  Evidence,
  Ladder,
  Neighbor,
  SimilarityFile,
  Study,
  PatientOrg,
  Grant,
  Investigator,
  TransferPair,
  Brief,
  BuildManifest,
  PhenotypesFile,
  LiteratureFile,
} from "./schemas";

const DERIVED = path.join(process.cwd(), "data", "derived");

function readJson<T>(name: string, fallback: T): T {
  const p = path.join(DERIVED, name);
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8")) as T;
}

type DemoCandidate = { conditionId: string; neighborId: string; counterexampleId?: string; score: number; reason: string };

type Store = {
  atlas: Atlas;
  conditions: Map<string, Condition>;
  similarity: SimilarityFile;
  neighborCache: Map<string, Neighbor[]>;
  ladders: Record<string, Ladder>;
  evidence: Record<string, Evidence>;
  studies: Record<string, Study>;
  orgs: Record<string, PatientOrg>;
  grants: Record<string, Grant>;
  investigators: Record<string, Investigator>;
  transfers: { cutoffs: { high: number; medium: number }; focalIds: string[]; pairCount: number };
  manifest: BuildManifest | null;
  demo: DemoCandidate[];
  phenotypes: PhenotypesFile | null;
  literature: LiteratureFile | null;
  layout: { nodes: Record<string, { x: number; y: number }>; edges: [string, string, number][]; threshold: number } | null;
  baseline: Baseline | null;
};
export type Baseline = {
  computedAt: string;
  pairs: { orgId: string; orgName: string; foundedYear: number; foundedUrl: string; foundedSnippet: string; conditionIds: string[]; studyId: string; studyTitle: string; studyRole: string; studyStartDate: string; years: number; evidenceIds: string[] }[];
  medianYears: number | null;
  minYears: number | null;
  maxYears: number | null;
  orgsWithFoundingYear: number;
  orgsPassed: number;
};

let store: Store | null = null;

export function getStore(): Store {
  if (store && process.env.NODE_ENV === "production") return store;
  const atlas = readJson<Atlas>("atlas.json", { builtAt: "", conditions: [], genes: [], roads: [], clusters: [] });
  store = {
    atlas,
    conditions: new Map(atlas.conditions.map((c) => [c.id, c])),
    similarity: readJson<SimilarityFile>("similarity.json", { cutoffs: { high: 1, medium: 1, edge: 1 }, conditionIds: [] }),
    neighborCache: new Map(),
    ladders: readJson<{ ladders: Record<string, Ladder> }>("ladders.json", { ladders: {} }).ladders,
    evidence: readJson<Record<string, Evidence>>("evidence.json", {}),
    studies: readJson<{ studies: Record<string, Study> }>("studies.json", { studies: {} }).studies,
    orgs: readJson<{ orgs: Record<string, PatientOrg> }>("orgs.json", { orgs: {} }).orgs,
    grants: readJson<{ grants: Record<string, Grant> }>("funding.json", { grants: {} }).grants,
    investigators: readJson<{ investigators: Record<string, Investigator> }>("investigators.json", { investigators: {} }).investigators,
    transfers: readJson("transfers.json", { cutoffs: { high: 1, medium: 1 }, focalIds: [], pairCount: 0 }),
    manifest: readJson<BuildManifest | null>("build-manifest.json", null),
    demo: readJson<DemoCandidate[]>("demo_candidates.json", []),
    phenotypes: readJson<PhenotypesFile | null>("phenotypes.json", null),
    literature: readJson<LiteratureFile | null>("literature.json", null),
    layout: readJson("layout.json", null),
    baseline: readJson<Baseline | null>("baseline.json", null),
  };
  return store;
}

export function conditionIdFromSlug(slug: string) {
  return slug.startsWith("cond:") ? slug : `cond:${slug}`;
}
export function slugOf(conditionId: string) {
  return conditionId.replace(/^cond:/, "");
}
export function conditionHref(conditionId: string) {
  return `/condition/${slugOf(conditionId)}`;
}
export function roadSlug(roadId: string) {
  return roadId.replace(/^road:/, "").replace(/:/g, "-");
}
export function roadIdFromSlug(slug: string) {
  return `road:${slug.replace(/-/g, ":")}`;
}

export function getCondition(id: string): Condition | undefined {
  return getStore().conditions.get(id);
}

export function getNeighbors(id: string): Neighbor[] {
  const st = getStore();
  const hit = st.neighborCache.get(id);
  if (hit) return hit;
  const p = path.join(DERIVED, "similarity", `${slugOf(id)}.json`);
  const list = fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as { neighbors: Neighbor[] }).neighbors : [];
  st.neighborCache.set(id, list);
  return list;
}

export function getLadder(id: string): Ladder | undefined {
  return getStore().ladders[id];
}

export function getEvidence(ids: Iterable<string>): Record<string, Evidence> {
  const all = getStore().evidence;
  const out: Record<string, Evidence> = {};
  for (const id of ids) if (all[id]) out[id] = all[id];
  return out;
}

export function getStudiesFor(conditionId: string): Study[] {
  return Object.values(getStore().studies).filter((s) => s.conditionIds.includes(conditionId));
}

export function getOrgsFor(conditionId: string): PatientOrg[] {
  return Object.values(getStore().orgs).filter((o) => o.conditionIds.includes(conditionId));
}

export function getGrantsFor(conditionId: string): Grant[] {
  return Object.values(getStore().grants).filter((g) => g.conditionIds.includes(conditionId));
}

export function getInvestigatorsFor(conditionIds: string[]): Investigator[] {
  const set = new Set(conditionIds);
  return Object.values(getStore().investigators).filter((i) => i.conditionIds.some((c) => set.has(c)));
}

const transferCache = new Map<string, Record<string, TransferPair>>();
export function getTransferPairsFor(focalId: string): Record<string, TransferPair> {
  const hit = transferCache.get(focalId);
  if (hit && process.env.NODE_ENV === "production") return hit;
  const p = path.join(DERIVED, "transfers", `${slugOf(focalId)}.json`);
  const data = fs.existsSync(p) ? (JSON.parse(fs.readFileSync(p, "utf8")) as { pairs: Record<string, TransferPair> }).pairs : {};
  transferCache.set(focalId, data);
  return data;
}
export function getTransferPair(focalId: string, neighborId: string): TransferPair | undefined {
  return getTransferPairsFor(focalId)[`${focalId}__${neighborId}`];
}

export function getBrief(focalId: string, neighborId: string): Brief | null {
  const p = path.join(DERIVED, "briefs", `${slugOf(focalId)}__${slugOf(neighborId)}.json`);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, "utf8")) as Brief;
}

export function getDemoCandidates() {
  return getStore().demo;
}

/** Collect every evidence id referenced by a set of objects (recursively looks for evidenceIds arrays). */
export function collectEvidenceIds(...objs: unknown[]): Set<string> {
  const out = new Set<string>();
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    if (Array.isArray(o)) {
      for (const x of o) walk(x);
      return;
    }
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if ((k === "evidenceIds" || k === "evidenceId") && v) {
        if (Array.isArray(v)) for (const id of v) if (typeof id === "string") out.add(id);
        else if (typeof v === "string") out.add(v);
      } else walk(v);
    }
  };
  for (const o of objs) walk(o);
  return out;
}
