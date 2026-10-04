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

export const ClaimCategory = z.enum([
  "keep_patient_cohort_mixed_directions",
  "keep_functional_characterization_of_patient_variants",
  "keep_patient_variants_other_direction",
  "reject_different_gene",
  "reject_non_variant_manipulation",
  "reject_therapy_mechanism",
  "reject_cancer_or_dosage_context",
  "reject_no_direction_asserted",
]);
export const ClaimReviewSchema = z.object({
  category: ClaimCategory,
  sameVariantClassDispute: z.boolean().describe("True only when the abstract argues the opposite direction for the SAME class of variants the curated record covers, so the two sources genuinely disagree; false when it describes an additional class of variants acting in another direction"),
  confidence: z.enum(["low", "medium", "high"]),
  reason: z.string().describe("One line grounded in the abstract"),
});
export type ClaimReview = z.infer<typeof ClaimReviewSchema> & { decision: "keep" | "reject"; inPatients: boolean; sameGene: boolean };
export type ReviewFile = { reviewedAt: string; reviewer: string; model: string; method: string; claims: Record<string, ClaimReview & { pmid: string; geneSymbol: string; direction: string; reviewer?: string }> };

const T5_SYSTEM = `You review one published claim about the direction of a gene's disease mechanism against a curated record. Judge from the FULL ABSTRACT, not from the quoted sentence alone. Return one category and a one-line reason.

KEEP the claim when the abstract reports disease-causing variants in the same gene, found in patients, whose functional effect is in a different direction from the curated record. This includes:
- keep_patient_cohort_mixed_directions: a patient cohort or case series in which some variants act in one direction and others in the other (for example both loss- and gain-of-function variants among affected individuals).
- keep_functional_characterization_of_patient_variants: functional characterization of patient variants in cell systems (for example electrophysiology of the variant channel in heterologous cells, biochemical assays of the variant protein) or in animals carrying the patient variant. This is the standard evidence for a variant's direction; it is NOT an experimental manipulation.
- keep_patient_variants_other_direction: any other report of patient variants in this gene whose functional effect is in a direction different from the curated record.

REJECT only when:
- reject_different_gene: the abstract is about a different gene, or the sentence concerns another gene mentioned in the paper.
- reject_non_variant_manipulation: the direction comes from a manipulation that is not a patient variant (a knockout or knockdown of the normal gene, overexpression of the normal gene, a drug or compound), with no patient variant characterized.
- reject_therapy_mechanism: the sentence describes a therapy's mechanism of action rather than a variant's effect.
- reject_cancer_or_dosage_context: a cancer or somatic context, or a chromosomal-dosage context such as a trisomy or large copy-number change, rather than the monogenic disease.
- reject_no_direction_asserted: the abstract does not actually assert a functional direction for this gene's patient variants (a prediction with no data, a vague statement, a misreading).

Generic examples: an abstract reporting that a de novo missense variant in a patient produced a gain of channel function in patch-clamp recordings is KEEP (functional characterization of a patient variant) even if the curated record says loss of function. An abstract reporting that a knockout mouse shows reduced protein activity is REJECT (non-variant manipulation). An abstract about a paralog is REJECT (different gene). An abstract reporting that most variants in a cohort cause loss but a subset cause gain is KEEP (mixed directions).

sameVariantClassDispute is true only when the abstract argues the opposite direction for the same class of variants the curated record covers (a genuine disagreement between sources); it is false when the abstract adds another class of variants acting differently. Never invent findings that are not in the abstract. Return JSON only.`;

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
  const out: ReviewFile = { reviewedAt: new Date().toISOString().slice(0, 10), reviewer: reviewerLabel(model), model, method: "T5: each verified claim that disagrees with the curated mechanism is read against its full cached abstract by the model with a structured output (keep categories: patient cohort with mixed directions, functional characterization of patient variants, other patient-variant report; reject categories: different gene, non-variant manipulation, therapy mechanism, cancer or dosage context, no direction asserted). Decisions are cached by content and re-run with the pipeline.", claims: {} };
  const results = await mapLimit(cands, 4, async (c) => {
    const abs = abstractFor(c.pmid);
    const user = `GENE: ${c.geneSymbol}\nCURATED RECORDS (Gene2Phenotype): ${c.curated.map((x) => `${x.conditionName}: ${x.mechanism}`).join("; ")}\n\nCLAIM extracted from PMID ${c.pmid}: direction ${c.direction}; mechanism "${c.mechanism}"; condition hint "${c.conditionHint}"\nVERBATIM SENTENCE: "${c.quote}"\n\nFULL ABSTRACT:\n${abs || "(abstract not cached; judge from the sentence alone and lower your confidence)"}`;
    try {
      const r = await llmStructured({ task: "T5", stage, model, schema: ClaimReviewSchema, schemaName: "claim_review", system: T5_SYSTEM, user, reasoning: "low", maxOutputTokens: 700 });
      const decision: "keep" | "reject" = r.data.category.startsWith("keep") ? "keep" : "reject";
      return { id: c.evidenceId, review: { ...r.data, decision, inPatients: decision === "keep", sameGene: r.data.category !== "reject_different_gene", pmid: c.pmid, geneSymbol: c.geneSymbol, direction: c.direction } };
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
