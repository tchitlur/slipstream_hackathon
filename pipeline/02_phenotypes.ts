/**
 * S2 Phenotypes: parse the HPO ontology, attach a phenotype set to each condition,
 * compute information content per term and write phenotypes.json.
 *
 * Matching order (SPEC S2): disease cross-reference into phenotype.hpoa first, then the
 * G2P record's own curated HPO terms, then gene + disease-name matching through
 * genes_to_phenotype.txt. Ambiguous gene matches are left unmatched (method "none").
 */
import { readValidated, writeJson, log } from "./lib/io";
import { files } from "./lib/paths";
import { loadOntology, loadHpoa, loadGenesToPhenotype, makeClosure, diseaseUrl, PHENOTYPIC_ABNORMALITY } from "./lib/hpo";
import { writeEvidence } from "./lib/evidence";
import { updateManifest } from "./lib/manifest";
import { AtlasSchema, type Evidence, type PhenotypesFile, type Condition } from "../src/lib/schemas";

const THIN = 5;

function normName(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\b(related|syndrome|disorder|disorders|disease|type|and|with|of|the|a)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenOverlap(a: string, b: string) {
  const ta = new Set(normName(a).split(" ").filter(Boolean));
  const tb = new Set(normName(b).split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let n = 0;
  for (const t of ta) if (tb.has(t)) n++;
  return n / Math.min(ta.size, tb.size);
}

async function main() {
  const atlas = readValidated(files.atlas, AtlasSchema);
  const ont = await loadOntology();
  const hpoa = await loadHpoa();
  const g2p = await loadGenesToPhenotype();
  const closure = makeClosure(ont);
  const isPhenotypic = (t: string) => closure(t).has(PHENOTYPIC_ABNORMALITY) && !ont.deprecated.has(t);

  const evidence: Evidence[] = [];
  const conditionTerms: Record<string, string[]> = {};
  const methodCounts: Record<string, number> = {};
  const hpoaDate = hpoa.retrievedAt.slice(0, 10);

  const annotationEvidence = (diseaseId: string): string => {
    const id = `ev:hpoa:${diseaseId}`;
    if (!evidence.some((e) => e.id === id)) {
      evidence.push({
        id,
        kind: "curated",
        source: "hpo",
        sourceId: diseaseId,
        url: diseaseUrl(diseaseId),
        retrievedAt: hpoaDate,
        confidence: "high",
        title: `HPO annotations for ${hpoa.names.get(diseaseId) ?? diseaseId}`,
        note: `${hpoa.terms.get(diseaseId)?.size ?? 0} phenotype terms annotated to ${diseaseId} in phenotype.hpoa (${hpoa.version}).`,
      });
    }
    return id;
  };

  for (const c of atlas.conditions) {
    let terms = new Set<string>();
    let method: Condition["phenotypeMatch"]["method"] = "none";
    let sourceId: string | undefined;
    const evIds: string[] = [];

    // 1. Cross-reference: G2P disease MIM -> OMIM:<mim> in phenotype.hpoa
    if (c.diseaseMim) {
      const did = `OMIM:${c.diseaseMim}`;
      const t = hpoa.terms.get(did);
      if (t && t.size) {
        terms = new Set(t);
        method = "hpoa_xref";
        sourceId = did;
        evIds.push(annotationEvidence(did));
        const nm = hpoa.names.get(did);
        if (nm && !c.synonyms.includes(nm) && nm !== c.name) c.synonyms.push(nm);
      }
    }
    // 2. G2P record's own curated HPO terms (union with 1 when both exist)
    const curated = c.curatedPhenotypeIds.filter(isPhenotypic);
    if (curated.length) {
      for (const t of curated) terms.add(t);
      if (method === "none") {
        method = "g2p_record";
        sourceId = c.g2pId;
      }
      if (!evIds.includes(c.evidenceIds[0])) evIds.push(c.evidenceIds[0]);
    }
    // 3. Gene + disease-name match through genes_to_phenotype.txt
    if (method === "none") {
      const diseases = g2p.byGene.get(c.geneSymbol);
      if (diseases && diseases.size) {
        const scored = [...diseases.keys()]
          .map((did) => ({ did, score: tokenOverlap(c.name.replace(c.geneSymbol, ""), hpoa.names.get(did) ?? did), n: diseases.get(did)!.size }))
          .sort((a, b) => b.score - a.score || b.n - a.n);
        const best = scored[0];
        const unique = diseases.size === 1;
        const clearWinner = best.score >= 0.5 && (scored.length === 1 || scored[1].score < best.score);
        if (unique || clearWinner) {
          terms = new Set(diseases.get(best.did));
          method = "gene_name";
          sourceId = best.did;
          evIds.push(annotationEvidence(best.did));
          const nm = hpoa.names.get(best.did);
          if (nm && !c.synonyms.includes(nm) && nm !== c.name) c.synonyms.push(nm);
        }
      }
    }

    const finalTerms = [...terms].filter(isPhenotypic);
    conditionTerms[c.id] = finalTerms.sort();
    c.phenotypeMatch = { method, sourceId, termCount: finalTerms.length };
    c.thinAnnotation = finalTerms.length < THIN;
    for (const id of evIds) if (!c.evidenceIds.includes(id)) c.evidenceIds.push(id);
    methodCounts[method] = (methodCounts[method] ?? 0) + 1;
  }

  // Information content: p = share of annotated diseases carrying the term or any descendant.
  // Corpus = all phenotype.hpoa diseases plus the conditions in this build (so every term in use has p > 0).
  const corpus: Set<string>[] = [];
  for (const t of hpoa.terms.values()) corpus.push(t);
  for (const c of atlas.conditions) if (conditionTerms[c.id].length) corpus.push(new Set(conditionTerms[c.id]));
  const counts = new Map<string, number>();
  for (const set of corpus) {
    const seen = new Set<string>();
    for (const t of set) for (const a of closure(t)) seen.add(a);
    for (const a of seen) counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  const N = corpus.length;
  const ic = (t: string) => {
    const n = counts.get(t) ?? 0;
    return n > 0 ? -Math.log(n / N) : -Math.log(1 / N);
  };

  // Terms in use: ancestor closure of every condition's set, restricted to phenotypic abnormality.
  const inUse = new Set<string>();
  for (const c of atlas.conditions) for (const t of conditionTerms[c.id]) for (const a of closure(t)) if (closure(a).has(PHENOTYPIC_ABNORMALITY)) inUse.add(a);
  const terms: PhenotypesFile["terms"] = {};
  for (const t of inUse) {
    terms[t] = { id: t, label: ont.labels.get(t) ?? t, ic: Number(ic(t).toFixed(4)), parents: (ont.parents.get(t) ?? []).filter((p) => inUse.has(p)) };
  }
  // Low-information line for counter-reason C1: the frequency-weighted median IC over direct annotation instances
  // (each condition-term annotation counts once). "Common" means frequently annotated, so the median must be weighted
  // by how often terms occur; an unweighted median over all terms in the closure drifts up as the atlas grows and made
  // C1 fire on every pair once the 2,800-condition shallow layer was added.
  const icValues: number[] = [];
  for (const c of atlas.conditions) for (const t of conditionTerms[c.id]) if (terms[t]) icValues.push(terms[t].ic);
  icValues.sort((a, b) => a - b);
  const medianIc = icValues.length ? icValues[Math.floor(icValues.length / 2)] : 0;

  // Gene-level HPO disease names (for synonym resolution in search).
  for (const g of atlas.genes) {
    const diseases = g2p.byGene.get(g.symbol);
    g.hpoDiseaseNames = diseases ? [...diseases.keys()].map((id) => ({ id, name: hpoa.names.get(id) ?? id })).filter((d) => d.name !== d.id) : [];
  }

  const out: PhenotypesFile = { terms, medianIc, annotatedDiseaseCount: N, conditionTerms };
  writeJson(files.phenotypes, out, { pretty: false });
  writeJson(files.atlas, atlas, { pretty: false });
  writeEvidence(["ev:hpoa:"], evidence);
  updateManifest((m) => {
    m.sources.hpo = { url: "https://purl.obolibrary.org/obo/hp.json", version: ont.version, retrievedAt: ont.retrievedAt };
    m.sources.hpoa = { url: "https://purl.obolibrary.org/obo/hp/hpoa/phenotype.hpoa", version: hpoa.version, retrievedAt: hpoa.retrievedAt };
    m.sources.genesToPhenotype = { url: "https://purl.obolibrary.org/obo/hp/hpoa/genes_to_phenotype.txt", retrievedAt: g2p.retrievedAt };
    m.counts.phenotypeTermsInUse = inUse.size;
    m.counts.annotatedDiseaseCorpus = N;
    m.counts.conditionsThinAnnotation = atlas.conditions.filter((c) => c.thinAnnotation).length;
    for (const [k, v] of Object.entries(methodCounts)) m.counts[`phenotypeMatch_${k}`] = v;
    m.thresholds.thinAnnotationTerms = THIN;
    m.thresholds.medianIc = Number(medianIc.toFixed(4));
  });
  log("S2", `matched: ${JSON.stringify(methodCounts)}; ${inUse.size} terms in use; median IC ${medianIc.toFixed(3)}; thin: ${atlas.conditions.filter((c) => c.thinAnnotation).length}`);
  const thin = atlas.conditions.filter((c) => c.thinAnnotation && c.depth === "deep");
  if (thin.length) log("S2", `thin deep conditions: ${thin.map((c) => `${c.g2pId}(${c.geneSymbol},${c.phenotypeMatch.termCount})`).join(" ")}`);
  const sizes = atlas.conditions.map((c) => c.phenotypeMatch.termCount).sort((a, b) => a - b);
  log("S2", `term counts: min ${sizes[0]} median ${sizes[Math.floor(sizes.length / 2)]} max ${sizes[sizes.length - 1]}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
