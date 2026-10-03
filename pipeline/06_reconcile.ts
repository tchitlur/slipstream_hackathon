/**
 * S6 Reconciliation: map free-text condition names from ClinicalTrials.gov and RePORTER to
 * Condition IDs. Deterministic first (exact, normalized, gene symbol), then LLM task T3 for
 * the unresolved remainder. Every decision is kept with its method so synonym resolution is
 * inspectable. Also refines study->condition assignment when a study's condition strings
 * name a specific curated condition of a multi-condition gene.
 */
import { z } from "zod";
import { parseArgs } from "./lib/args";
import { readValidated, readJsonOr, writeJson, log, uniq } from "./lib/io";
import { files } from "./lib/paths";
import { llmStructured, mapLimit, hasKey, confirmModels, readLedger } from "./lib/llm";
import { updateManifest } from "./lib/manifest";
import { AtlasSchema, StudiesFileSchema, FundingFileSchema, type Condition, type ReconciliationFileSchema } from "../src/lib/schemas";

type Decision = z.infer<typeof ReconciliationFileSchema>["decisions"][number];

export function normalizeName(s: string) {
  return s
    .toLowerCase()
    .replace(/[‐-―]/g, "-")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(related|the|a|an|of|with|and|or|type|disorder|disorders|disease|syndrome|syndromes|deficiency|encephalopathy|epileptic|developmental)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const T3Schema = z.object({ conditionId: z.string().describe("One of the candidate IDs, or 'none'."), reason: z.string().describe("One line.") });
const T3_SYSTEM = `You match a free-text disease name from a clinical-trial or grant record to one curated condition from a short candidate list, or answer 'none'.
Match only when the name clearly denotes the same disease entity as a candidate (including well-known eponyms and OMIM phenotype names). A broad category (e.g. "epilepsy", "autism") or a different disease of the same gene is 'none'. Return JSON only.`;

async function main() {
  const args = parseArgs();
  void args;
  const atlas = readValidated(files.atlas, AtlasSchema);
  const deep = atlas.conditions.filter((c) => c.depth === "deep");
  const exact = new Map<string, string>();
  const normalized = new Map<string, string[]>();
  const byGene = new Map<string, Condition[]>();
  for (const c of deep) {
    (byGene.get(c.geneSymbol) ?? byGene.set(c.geneSymbol, []).get(c.geneSymbol)!).push(c);
    for (const n of [c.name, ...c.synonyms]) {
      exact.set(n.toLowerCase(), c.id);
      const k = normalizeName(n);
      if (k.length >= 4) (normalized.get(k) ?? normalized.set(k, []).get(k)!).push(c.id);
    }
  }
  const genes = atlas.genes.map((g) => g.symbol);

  const decisions: Decision[] = [];
  const studiesRaw = readJsonOr<unknown>(files.studies, null);
  const studies = studiesRaw ? StudiesFileSchema.parse(studiesRaw) : null;
  const unresolved: { name: string; source: Decision["source"]; recordId: string; candidates: Condition[] }[] = [];

  const resolve = (name: string, source: Decision["source"], recordId: string, candidateConds: Condition[]) => {
    const lower = name.toLowerCase();
    const candIds = new Set(candidateConds.map((c) => c.id));
    const ex = exact.get(lower);
    if (ex && candIds.has(ex)) return decisions.push({ name, source, recordId, conditionId: ex, method: "exact" });
    const norm = normalized.get(normalizeName(name))?.filter((id) => candIds.has(id));
    if (norm && norm.length === 1) return decisions.push({ name, source, recordId, conditionId: norm[0], method: "normalized" });
    const geneHit = genes.find((g) => new RegExp(`\\b${g}\\b`, "i").test(name));
    if (geneHit) {
      const conds = (byGene.get(geneHit) ?? []).filter((c) => candIds.has(c.id));
      if (conds.length === 1) return decisions.push({ name, source, recordId, conditionId: conds[0].id, method: "gene" });
    }
    if (candidateConds.length) unresolved.push({ name, source, recordId, candidates: candidateConds });
    else decisions.push({ name, source, recordId, conditionId: null, method: "none", reason: "no candidate conditions for this record" });
  };

  if (studies) {
    for (const s of Object.values(studies.studies)) {
      if (!s.classification?.aboutCondition) continue;
      const candidateIds = uniq(s.hits.map((h) => h.conditionId));
      const cands = candidateIds.map((id) => atlas.conditions.find((c) => c.id === id)!).filter(Boolean);
      for (const name of s.conditions.slice(0, 12)) resolve(name, "ctgov", s.id, cands);
    }
  }
  const fundingRaw = readJsonOr<unknown>(files.funding, null);
  const funding = fundingRaw ? FundingFileSchema.parse(fundingRaw) : null;
  if (funding) {
    for (const g of Object.values(funding.grants)) {
      const cands = g.conditionIds.map((id) => atlas.conditions.find((c) => c.id === id)!).filter(Boolean);
      for (const term of g.queryTerms.filter((t) => !genes.includes(t))) resolve(term, "reporter", g.projectNumber, cands);
    }
  }

  // Only names that look like a disease (not a gene symbol, not generic) go to the LLM.
  const generic = /^(epilepsy|seizures?|autism|autism spectrum disorder|intellectual disability|developmental delay|neurodevelopmental disorders?|genetic epilepsy|rare diseases?|healthy volunteers?|epileptic encephalopathy|developmental and epileptic encephalopathy)$/i;
  const toLlm = unresolved.filter((u) => !generic.test(u.name.trim()) && !/^[A-Z0-9]{3,8}$/.test(u.name.trim()));
  for (const u of unresolved.filter((u) => !toLlm.includes(u))) decisions.push({ name: u.name, source: u.source, recordId: u.recordId, conditionId: null, method: "none", reason: "generic category or bare gene symbol" });
  // Deduplicate identical (name, candidate set) questions.
  const seen = new Map<string, typeof toLlm>();
  for (const u of toLlm) {
    const k = `${u.name.toLowerCase()}|${u.candidates.map((c) => c.id).sort().join(",")}`;
    (seen.get(k) ?? seen.set(k, []).get(k)!).push(u);
  }
  const questions = [...seen.values()];
  log("S6", `${decisions.length} deterministic decisions; ${unresolved.length} unresolved, ${questions.length} distinct questions for T3`);
  if (questions.length && hasKey()) {
    const models = await confirmModels();
    await mapLimit(questions, 4, async (group) => {
      const u = group[0];
      const user = `Name: "${u.name}"\nCandidates:\n${u.candidates.map((c) => `- ${c.id}: ${c.name} (gene ${c.geneSymbol}; also: ${c.synonyms.slice(0, 3).join("; ") || "none"})`).join("\n")}`;
      const r = await llmStructured({ task: "T3", stage: "S6", model: models.extract, schema: T3Schema, schemaName: "name_match", system: T3_SYSTEM, user, reasoning: "low", maxOutputTokens: 200 });
      const id = u.candidates.some((c) => c.id === r.data.conditionId) ? r.data.conditionId : null;
      for (const q of group) decisions.push({ name: q.name, source: q.source, recordId: q.recordId, conditionId: id, method: id ? "llm" : "none", reason: r.data.reason });
    });
  } else if (questions.length) {
    for (const group of questions) for (const q of group) decisions.push({ name: q.name, source: q.source, recordId: q.recordId, conditionId: null, method: "none", reason: "T3 not run (no key)" });
  }

  // Refine study -> condition assignment for multi-condition genes where names resolved to a specific condition.
  let refined = 0;
  if (studies) {
    for (const s of Object.values(studies.studies)) {
      if (!s.classification?.aboutCondition || s.conditionIds.length <= 1) continue;
      const resolved = uniq(decisions.filter((d) => d.source === "ctgov" && d.recordId === s.id && d.conditionId).map((d) => d.conditionId!));
      if (resolved.length && resolved.length < s.conditionIds.length && resolved.every((id) => s.conditionIds.includes(id))) {
        s.conditionIds = resolved;
        refined++;
      }
    }
    writeJson(files.studies, studies, { pretty: false });
  }
  writeJson(files.reconciliation, { decisions }, { pretty: false });
  const methods: Record<string, number> = {};
  for (const d of decisions) methods[d.method] = (methods[d.method] ?? 0) + 1;
  const l = readLedger();
  updateManifest((m) => {
    m.counts.reconciliationDecisions = decisions.length;
    for (const [k, v] of Object.entries(methods)) m.counts[`reconcile_${k}`] = v;
    m.counts.studiesRefinedByReconciliation = refined;
    m.llm.spendUsd = l.totalUsd;
    m.llm.byStage = Object.fromEntries(Object.entries(l.byStage).map(([k, v]) => [k, { calls: v.calls, inputTokens: v.inputTokens, outputTokens: v.outputTokens, usd: v.usd }]));
    m.llm.models = { ...l.models, ...m.llm.models };
  });
  log("S6", `decisions by method ${JSON.stringify(methods)}; ${refined} studies narrowed to specific conditions; spend $${l.totalUsd.toFixed(3)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
