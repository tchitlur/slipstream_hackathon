/**
 * Model-decided labels that the UI shows must come from pipeline stages that call the OpenAI API, so they re-run with
 * `npm run data:build` and are cached and priced like every other call. Two tasks live here:
 *   T5 (stage S4): review of published claims that disagree with the curated mechanism (keep or reject, in patients,
 *       same gene, same-variant-class dispute).
 *   T6 (stages S5 and S9): three-level target label for targeted trials and approved therapies.
 * Both are automated reviews by a language model, not a biomedical expert review, and are labelled as such everywhere.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { llmStructured, mapLimit, hasKey, MODEL_EXPLAIN } from "./llm";
import { log } from "./io";
import { RAW } from "./paths";
import { TargetLevel } from "../../src/lib/schemas";

export const REVIEW_MODEL = process.env.OPENAI_MODEL_REVIEW ?? MODEL_EXPLAIN;
export const reviewerLabel = (model: string) => `automated review (${model}), not a biomedical expert review`;

// ---------------------------------------------------------------------------
// T5: contested-claim review
// ---------------------------------------------------------------------------

export const ClaimReviewSchema = z.object({
  decision: z.enum(["keep", "reject"]),
  inPatients: z.boolean().describe("The claim describes variants observed in human patients, not only animal or cell models"),
  sameGene: z.boolean().describe("The claim is about the gene named, not a paralog or another gene in the same paper"),
  sameVariantClassDispute: z.boolean().describe("The paper argues the opposite direction for the SAME class of variants the curated record covers (a genuine dispute), rather than describing a different variant class"),
  confidence: z.enum(["low", "medium", "high"]),
  reason: z.string().describe("One or two sentences grounded in the abstract"),
});
export type ClaimReview = z.infer<typeof ClaimReviewSchema>;
export type ReviewFile = { reviewedAt: string; reviewer: string; model: string; method: string; claims: Record<string, ClaimReview & { pmid: string; geneSymbol: string; direction: string }> };

const T5_SYSTEM = `You review one published claim about a gene's disease mechanism against a curated record. Read the full abstract. Decide:
- decision: "keep" if the claim really states, for human patient variants of this gene, a mechanism direction different from the curated one; "reject" if the sentence is about another gene, about animal or cell models only, a prediction without data, a misreading, or does not actually assert a direction for this gene's patient variants.
- inPatients, sameGene, sameVariantClassDispute as defined in the schema. A dominant-negative or gain-of-function finding for a DIFFERENT class of variants than the curated record (for example missense gain of function when the curated record is loss of function from truncating variants) is not a same-variant-class dispute.
- reason: one or two sentences citing what the abstract says. Never invent findings that are not in the abstract.
Return JSON only.`;

export type ClaimCandidate = { evidenceId: string; pmid: string; geneSymbol: string; direction: string; mechanism: string; conditionHint: string; quote: string; curated: { conditionName: string; mechanism: string }[] };

function abstractFor(pmid: string): string {
  const p = path.join(RAW, "pubmed", "abstracts", `${pmid}.txt`);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8").slice(0, 7000) : "";
}

export async function reviewContestedClaims(cands: ClaimCandidate[], stage = "S4"): Promise<ReviewFile | null> {
  if (!hasKey()) {
    log(stage, "T5 skipped: no OPENAI_API_KEY; claims are shown unreviewed");
    return null;
  }
  const model = REVIEW_MODEL;
  const out: ReviewFile = { reviewedAt: new Date().toISOString().slice(0, 10), reviewer: reviewerLabel(model), model, method: "T5: each verified claim that disagrees with the curated mechanism is read against its full cached abstract by the model with a structured output; the quote and the curated record are given. Decisions are cached by content and re-run with the pipeline.", claims: {} };
  const results = await mapLimit(cands, 4, async (c) => {
    const abs = abstractFor(c.pmid);
    const user = `GENE: ${c.geneSymbol}\nCURATED RECORDS (Gene2Phenotype): ${c.curated.map((x) => `${x.conditionName}: ${x.mechanism}`).join("; ")}\n\nCLAIM extracted from PMID ${c.pmid}: direction ${c.direction}; mechanism "${c.mechanism}"; condition hint "${c.conditionHint}"\nVERBATIM SENTENCE: "${c.quote}"\n\nFULL ABSTRACT:\n${abs || "(abstract not cached; judge from the sentence alone and lower your confidence)"}`;
    try {
      const r = await llmStructured({ task: "T5", stage, model, schema: ClaimReviewSchema, schemaName: "claim_review", system: T5_SYSTEM, user, reasoning: "low", maxOutputTokens: 700 });
      return { id: c.evidenceId, review: { ...r.data, pmid: c.pmid, geneSymbol: c.geneSymbol, direction: c.direction } };
    } catch (e) {
      log(stage, `T5 failed for ${c.evidenceId}: ${(e as Error).message.slice(0, 120)}`);
      return null;
    }
  });
  for (const r of results) if (r) out.claims[r.id] = r.review;
  log(stage, `T5: reviewed ${Object.keys(out.claims).length}/${cands.length} dissenting claims with ${model}`);
  return out;
}

// ---------------------------------------------------------------------------
// T6: three-level target labels
// ---------------------------------------------------------------------------

export const TargetReviewSchema = z.object({
  target: TargetLevel,
  intervention: z.string(),
  reason: z.string().describe("One sentence quoting or closely paraphrasing the record"),
  confidence: z.enum(["low", "medium", "high"]).describe("low when the record does not state what the intervention acts on"),
});
export type TargetReview = z.infer<typeof TargetReviewSchema>;
export type LevelsFile = { reviewedAt: string; reviewer: string; model: string; levels: Record<string, TargetReview> };

const T6_SYSTEM = `You assign one of three target levels to an intervention for a monogenic condition, from the record text only:
- gene_product: acts on the gene, its transcript or its protein product (antisense oligonucleotide for the gene, gene therapy or editing, a drug that restores or modulates the gene's own protein, enzyme replacement for the defective enzyme).
- pathway: acts on a downstream pathway the record names as the rationale (for example mTOR inhibition for TSC, GH/IGF-1 axis, a signalling pathway downstream of the gene).
- symptomatic_or_unknown: treats symptoms (broad anti-seizure medicine, diet, device, behavioral therapy) or the record does not establish a mechanism link.
Use only what the record states. If the record is silent on what the intervention acts on, choose symptomatic_or_unknown with confidence "low". Return JSON only.`;

export async function labelStudyTargets(items: { id: string; geneSymbol: string; conditionName: string; mechanism: string; text: string }[], stage = "S5"): Promise<LevelsFile | null> {
  if (!hasKey()) {
    log(stage, "T6 skipped: no OPENAI_API_KEY; target levels fall back to modality rules");
    return null;
  }
  const model = REVIEW_MODEL;
  const out: LevelsFile = { reviewedAt: new Date().toISOString().slice(0, 10), reviewer: reviewerLabel(model), model, levels: {} };
  const results = await mapLimit(items, 4, async (s) => {
    const user = `CONDITION: ${s.conditionName} (gene ${s.geneSymbol}; curated mechanism ${s.mechanism})\n\nCLINICALTRIALS.GOV RECORD:\n${s.text.slice(0, 9000)}`;
    try {
      const r = await llmStructured({ task: "T6", stage, model, schema: TargetReviewSchema, schemaName: "target_level", system: T6_SYSTEM, user, reasoning: "low", maxOutputTokens: 500 });
      return { id: s.id, review: r.data };
    } catch (e) {
      log(stage, `T6 failed for ${s.id}: ${(e as Error).message.slice(0, 120)}`);
      return null;
    }
  });
  for (const r of results) if (r) out.levels[r.id] = r.review;
  log(stage, `T6: labelled ${Object.keys(out.levels).length}/${items.length} targeted trials with ${model}`);
  return out;
}

export async function labelTherapyTargets(items: { key: string; therapy: string; geneSymbol: string; conditionName: string; mechanism: string; indicationQuote: string; regulator: string }[], stage = "S9"): Promise<LevelsFile | null> {
  if (!hasKey()) return null;
  const model = REVIEW_MODEL;
  const out: LevelsFile = { reviewedAt: new Date().toISOString().slice(0, 10), reviewer: reviewerLabel(model), model, levels: {} };
  const results = await mapLimit(items, 4, async (t) => {
    const user = `CONDITION: ${t.conditionName} (gene ${t.geneSymbol}; curated mechanism ${t.mechanism})\nAPPROVED THERAPY: ${t.therapy} (${t.regulator})\nLABEL INDICATION TEXT: "${t.indicationQuote}"\n\nUse the label text and the general, well-established mechanism of action of this approved product. If its mechanism in this condition is not established or it is a broad symptomatic treatment, choose symptomatic_or_unknown.`;
    try {
      const r = await llmStructured({ task: "T6", stage, model, schema: TargetReviewSchema, schemaName: "target_level", system: T6_SYSTEM, user, reasoning: "low", maxOutputTokens: 500 });
      return { id: t.key, review: r.data };
    } catch (e) {
      log(stage, `T6 (therapy) failed for ${t.key}: ${(e as Error).message.slice(0, 120)}`);
      return null;
    }
  });
  for (const r of results) if (r) out.levels[r.id] = r.review;
  log(stage, `T6: labelled ${Object.keys(out.levels).length}/${items.length} approved therapies with ${model}`);
  return out;
}
