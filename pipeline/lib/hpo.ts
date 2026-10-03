import path from "node:path";
import { downloadCached } from "./http";
import { readText, log } from "./io";

export type Ontology = {
  version: string;
  labels: Map<string, string>;
  parents: Map<string, string[]>;
  deprecated: Set<string>;
  retrievedAt: string;
};

const HP_JSON = "https://purl.obolibrary.org/obo/hp.json";
const HPOA = "https://purl.obolibrary.org/obo/hp/hpoa/phenotype.hpoa";
const G2P_TXT = "https://purl.obolibrary.org/obo/hp/hpoa/genes_to_phenotype.txt";

export const PHENOTYPIC_ABNORMALITY = "HP:0000118";

export async function loadOntology(): Promise<Ontology> {
  const dl = await downloadCached(HP_JSON, path.join("hpo", "hp.json.gz"), { gzip: true });
  const doc = JSON.parse(readText(dl.path)) as { graphs: { meta?: { version?: string }; nodes: { id: string; lbl?: string; meta?: { deprecated?: boolean } }[]; edges: { sub: string; pred: string; obj: string }[] }[] };
  const g = doc.graphs[0];
  const toId = (iri: string) => iri.replace("http://purl.obolibrary.org/obo/HP_", "HP:");
  const labels = new Map<string, string>();
  const deprecated = new Set<string>();
  for (const n of g.nodes) {
    if (!n.id.includes("/HP_")) continue;
    const id = toId(n.id);
    if (n.lbl) labels.set(id, n.lbl);
    if (n.meta?.deprecated) deprecated.add(id);
  }
  const parents = new Map<string, string[]>();
  for (const e of g.edges) {
    if (e.pred !== "is_a" || !e.sub.includes("/HP_") || !e.obj.includes("/HP_")) continue;
    const s = toId(e.sub);
    const o = toId(e.obj);
    (parents.get(s) ?? parents.set(s, []).get(s)!).push(o);
  }
  log("hpo", `ontology ${g.meta?.version ?? "?"}: ${labels.size} terms, ${g.edges.length} is_a edges`);
  return { version: g.meta?.version ?? "unknown", labels, parents, deprecated, retrievedAt: dl.retrievedAt };
}

/** Ancestor closure including the term itself. Memoized. */
export function makeClosure(ont: Ontology) {
  const memo = new Map<string, Set<string>>();
  const closure = (t: string): Set<string> => {
    const hit = memo.get(t);
    if (hit) return hit;
    const out = new Set<string>([t]);
    for (const p of ont.parents.get(t) ?? []) for (const a of closure(p)) out.add(a);
    memo.set(t, out);
    return out;
  };
  return closure;
}

export type DiseaseAnnotations = {
  version: string;
  retrievedAt: string;
  /** disease id (OMIM:..., ORPHA:...) -> phenotype terms (aspect P, not negated) */
  terms: Map<string, Set<string>>;
  names: Map<string, string>;
};

export async function loadHpoa(): Promise<DiseaseAnnotations> {
  const dl = await downloadCached(HPOA, path.join("hpo", "phenotype.hpoa.gz"), { gzip: true });
  const text = readText(dl.path);
  const terms = new Map<string, Set<string>>();
  const names = new Map<string, string>();
  let version = "unknown";
  for (const line of text.split("\n")) {
    if (line.startsWith("#")) {
      const m = line.match(/^#version:\s*(\S+)/);
      if (m) version = m[1];
      continue;
    }
    if (!line || line.startsWith("database_id")) continue;
    const f = line.split("\t");
    const [diseaseId, diseaseName, qualifier, hpoId] = f;
    const aspect = f[10];
    if (aspect !== "P" || qualifier === "NOT") continue;
    names.set(diseaseId, diseaseName);
    (terms.get(diseaseId) ?? terms.set(diseaseId, new Set()).get(diseaseId)!).add(hpoId);
  }
  log("hpo", `phenotype.hpoa ${version}: ${terms.size} diseases with phenotype annotations`);
  return { version, retrievedAt: dl.retrievedAt, terms, names };
}

export type GeneAnnotations = {
  retrievedAt: string;
  /** gene symbol -> disease id -> terms */
  byGene: Map<string, Map<string, Set<string>>>;
};

export async function loadGenesToPhenotype(): Promise<GeneAnnotations> {
  const dl = await downloadCached(G2P_TXT, path.join("hpo", "genes_to_phenotype.txt.gz"), { gzip: true });
  const text = readText(dl.path);
  const byGene = new Map<string, Map<string, Set<string>>>();
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("ncbi_gene_id")) continue;
    const [, symbol, hpoId, , , diseaseId] = line.split("\t");
    if (!symbol || !hpoId || !diseaseId) continue;
    const g = byGene.get(symbol) ?? byGene.set(symbol, new Map()).get(symbol)!;
    (g.get(diseaseId) ?? g.set(diseaseId, new Set()).get(diseaseId)!).add(hpoId);
  }
  log("hpo", `genes_to_phenotype: ${byGene.size} genes`);
  return { retrievedAt: dl.retrievedAt, byGene };
}

export function diseaseUrl(diseaseId: string) {
  return `https://hpo.jax.org/browse/disease/${diseaseId}`;
}
export function termUrl(hpId: string) {
  return `https://hpo.jax.org/browse/term/${hpId}`;
}
