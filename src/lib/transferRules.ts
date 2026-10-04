/**
 * Transfer rules (SPEC section 9.4) and counter-reasons (section 9.5), kept as data so the
 * Method page can render the table and unit tests can exercise each rule.
 */
import type { Verdict, RuleId, CounterCode, MechanismRelation } from "./schemas";

export type SimBand = "high" | "medium" | "low";

export type RuleContext = {
  simBand: SimBand;
  relation: MechanismRelation;
  /** Relation from curated mechanisms alone (same as relation unless contested). */
  curatedRelation?: MechanismRelation;
  /** Gene symbol(s) whose mechanism is contested, for wording. */
  contestedSide?: string;
  sharedInvestigator: boolean;
  /** Modalities of the neighbor's targeted trials, if any. */
  neighborModalities: string[];
};

export type RuleDef = {
  id: RuleId;
  asset: string;
  shortAsset: string;
  logic: string;
  apply: (ctx: RuleContext) => { verdict: Verdict | null; reason: string; warning?: boolean };
};

export const RULES: RuleDef[] = [
  {
    id: "R1",
    asset: "Registry design and natural history protocol",
    shortAsset: "Registry / natural history protocol",
    logic: "High phenotype similarity: transferable. Medium: needs expert review. Mechanism does not matter.",
    apply: (ctx) => {
      if (ctx.simBand === "high") return { verdict: "transferable", reason: "Phenotype similarity is high, so the data items and visit schedule of a registry or natural history protocol are likely to carry over. Mechanism does not change what a registry records." };
      if (ctx.simBand === "medium") return { verdict: "needs_expert_review", reason: "Phenotype similarity is medium. The protocol is a useful starting point, but an expert should check which domains apply." };
      return { verdict: "do_not_transfer", reason: "Phenotype similarity is below the medium cutoff, so the protocol was built for a clinical picture that differs from this one." };
    },
  },
  {
    id: "R2",
    asset: "Outcome measures and endpoints",
    shortAsset: "Outcome measures",
    logic: "Same as R1, and always flag age of onset and severity for review.",
    apply: (ctx) => {
      if (ctx.simBand === "high") return { verdict: "transferable", reason: "Phenotype similarity is high, so the measured domains overlap. Age of onset and severity still need review before any instrument is adopted." };
      if (ctx.simBand === "medium") return { verdict: "needs_expert_review", reason: "Phenotype similarity is medium. Some instruments will fit and some will not; age of onset and severity decide which." };
      return { verdict: "do_not_transfer", reason: "Phenotype similarity is below the medium cutoff, so the endpoints were chosen for a different clinical picture." };
    },
  },
  {
    id: "R3",
    asset: "Clinical network, sites and investigators",
    shortAsset: "Clinical network",
    logic: "Medium or higher phenotype similarity, or a shared investigator: transferable.",
    apply: (ctx) => {
      if (ctx.sharedInvestigator) return { verdict: "transferable", reason: "At least one investigator already works on both conditions, so the clinical network is reachable through a public record." };
      if (ctx.simBand !== "low") return { verdict: "transferable", reason: "Phenotype similarity is at least medium, so the sites that see the neighbor's patients see a similar clinical picture." };
      return { verdict: "needs_expert_review", reason: "Phenotype similarity is low and no shared investigator was found; the network may still help but there is no computed reason to expect it." };
    },
  },
  {
    id: "R4",
    asset: "Therapeutic strategy and modality",
    shortAsset: "Therapeutic strategy",
    logic: "Same road: needs expert review, with the modality named. Opposite direction: do not transfer (explicit warning). Unknown or contested: needs expert review, stating what must be established first.",
    apply: (ctx) => {
      const modsText = ctx.neighborModalities.length ? ` (neighbor modality: ${ctx.neighborModalities.map((m) => m.replace(/_/g, " ")).join(", ")})` : "";
      if (ctx.relation === "same road") return { verdict: "needs_expert_review", reason: `Both conditions are on the same mechanism road, so the same therapeutic logic may apply${modsText}. An expert must confirm the individual variant behaves the same way.` };
      if (ctx.relation === "opposite direction") return { verdict: "do_not_transfer", warning: true, reason: `The mechanisms point in opposite directions: a strategy that raises protein output for one would be the wrong direction for a protein that is overactive or interfering${modsText}.` };
      if (ctx.relation === "contested") {
        const cur = ctx.curatedRelation ?? "unknown";
        const who = ctx.contestedSide ? ` for ${ctx.contestedSide}` : "";
        if (cur === "opposite direction") return { verdict: "needs_expert_review", warning: true, reason: `On the curated mechanisms the two conditions point in opposite directions, which would mean do not transfer. Published claims dispute the curated direction${who}, so this is held for expert review instead of being ruled out. Until that is settled, treat the therapeutic strategy as not shared${modsText}.` };
        if (cur === "same road") return { verdict: "needs_expert_review", reason: `On the curated mechanisms the two conditions are on the same road, but published claims dispute the curated direction${who}. Which direction applies must be settled before any therapeutic logic is borrowed${modsText}.` };
        return { verdict: "needs_expert_review", reason: `The mechanism${who} is contested between curated and published claims. Which direction applies must be settled before any therapeutic logic is borrowed.` };
      }
      if (ctx.relation === "different road") return { verdict: "needs_expert_review", reason: `The conditions share a direction but differ in allelic requirement, so dosage logic differs${modsText}. An expert must check whether the strategy depends on the remaining healthy copy.` };
      return { verdict: "needs_expert_review", reason: "The mechanism of at least one condition is not established in the curated source. It must be established before any therapeutic logic is borrowed." };
    },
  },
  {
    id: "R5",
    asset: "Disease models and assays",
    shortAsset: "Models and assays",
    logic: "The model itself is gene-specific: do not transfer. The assay design is reusable on the same road: needs expert review.",
    apply: (ctx) => {
      if (ctx.relation === "same road") return { verdict: "needs_expert_review", reason: "The neighbor's animal or cell model is specific to its gene and cannot stand in for this one. The assay design (what is measured and how) is reusable on the same road, subject to expert review." };
      return { verdict: "do_not_transfer", reason: "The neighbor's model is specific to its gene, and the conditions are not on the same road, so neither the model nor its readouts carry over without new validation." };
    },
  },
  {
    id: "R6",
    asset: "Trial design",
    shortAsset: "Trial design",
    logic: "Same road and high phenotype similarity: needs expert review. Otherwise: do not transfer.",
    apply: (ctx) => {
      if (ctx.relation === "same road" && ctx.simBand === "high") return { verdict: "needs_expert_review", reason: "Same road and high phenotype similarity: the neighbor's trial design (population, endpoints, duration) is a credible template, pending expert review." };
      return { verdict: "do_not_transfer", reason: ctx.relation === "same road" ? "Same road, but phenotype similarity is not high, so the population and endpoints of the neighbor's trial were defined for a different clinical picture." : "The conditions are not on the same road, so a trial built around the neighbor's mechanism does not carry over." };
    },
  },
  {
    id: "R7",
    asset: "Enrolment in the neighbor's trial",
    shortAsset: "Enrolment",
    logic: "Never asserted. Show the trial's eligibility excerpt and tell the family to ask the study team.",
    apply: () => ({ verdict: null, reason: "Slipstream never asserts eligibility. The eligibility excerpt is shown so the family can ask the study team directly." }),
  },
];

export const COUNTER_REASONS: Record<CounterCode, { title: string; appliesTo: string }> = {
  C1: { title: "Overlap rests on common symptoms", appliesTo: "Most of the phenotype overlap comes from common, low-information symptoms." },
  C2: { title: "Mechanism is per gene and disease, not per variant", appliesTo: "Shown on every R4, R5 and R6 verdict. An individual's variant may act differently; confirm its class with a clinical geneticist." },
  C3: { title: "Mechanism direction varies or is contested", appliesTo: "Published cases document variants in the other direction (both directions reported), a different mechanism such as dominant negative is also reported against a loss-of-function record, or published claims dispute the curated direction for the same variant class (contested)." },
  C4: { title: "Mechanism support is inferred", appliesTo: "The curated mechanism is inferred, not based on functional evidence." },
  C5: { title: "Allelic requirement differs", appliesTo: "One condition is monoallelic and the other biallelic (or another pattern)." },
  C6: { title: "Thin phenotype annotation", appliesTo: "Either condition has fewer than five annotated phenotypes, so similarity is unreliable." },
  C7: { title: "Asset rests on a single or inactive study", appliesTo: "The neighbor's asset rests on one study, or one that is terminated, withdrawn or not yet recruiting." },
  C8: { title: "Organization listing is not human-verified", appliesTo: "The organization entry passed only an automated check of its own site (or failed it); no human has verified it." },
  C9: { title: "Age of onset and severity may differ", appliesTo: "Registry items, visit schedules and outcome measures are built around a typical age of onset and severity; phenotype similarity does not check either, so both must be reviewed before anything is adopted." },
};

/** Which counter-reason codes are eligible for each rule, in priority order (strongest first). */
/** C2, C3 and C4 are about mechanism and apply only to R4 to R7; R1 to R3 say mechanism does not matter. */
export const COUNTER_PRIORITY: Record<RuleId, CounterCode[]> = {
  R1: ["C6", "C1", "C7", "C5", "C9"],
  R2: ["C9", "C6", "C1", "C7", "C5"],
  R3: ["C8", "C6", "C1", "C7"],
  R4: ["C3", "C2", "C4", "C5", "C7"],
  R5: ["C3", "C2", "C4", "C5"],
  R6: ["C3", "C2", "C4", "C6", "C1", "C7", "C5"],
  R7: ["C7", "C3", "C2"],
};
export const MECHANISM_RULES: RuleId[] = ["R4", "R5", "R6", "R7"];

export const ALWAYS_C2: RuleId[] = ["R4", "R5", "R6"];

export function ruleById(id: RuleId) {
  return RULES.find((r) => r.id === id)!;
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  transferable: "Transferable",
  needs_expert_review: "Needs expert review",
  do_not_transfer: "Do not transfer",
};
