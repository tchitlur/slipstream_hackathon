import { describe, it, expect } from "vitest";
import { RULES, ruleById, COUNTER_PRIORITY, ALWAYS_C2, type RuleContext } from "@/lib/transferRules";

const base: RuleContext = { simBand: "high", relation: "same road", sharedInvestigator: false, neighborModalities: ["antisense"] };

describe("transfer rules", () => {
  it("defines R1 to R7 with counter-reason priorities", () => {
    expect(RULES.map((r) => r.id)).toEqual(["R1", "R2", "R3", "R4", "R5", "R6", "R7"]);
    for (const r of RULES) expect(COUNTER_PRIORITY[r.id].length).toBeGreaterThan(0);
    expect(ALWAYS_C2).toEqual(["R4", "R5", "R6"]);
  });
  it("R1/R2: high similarity transferable, medium review, low do not transfer; mechanism ignored", () => {
    for (const id of ["R1", "R2"] as const) {
      expect(ruleById(id).apply({ ...base, relation: "opposite direction" }).verdict).toBe("transferable");
      expect(ruleById(id).apply({ ...base, simBand: "medium" }).verdict).toBe("needs_expert_review");
      expect(ruleById(id).apply({ ...base, simBand: "low" }).verdict).toBe("do_not_transfer");
    }
  });
  it("R3: medium+ similarity or shared investigator is transferable", () => {
    expect(ruleById("R3").apply({ ...base, simBand: "medium" }).verdict).toBe("transferable");
    expect(ruleById("R3").apply({ ...base, simBand: "low", sharedInvestigator: true }).verdict).toBe("transferable");
    expect(ruleById("R3").apply({ ...base, simBand: "low" }).verdict).toBe("needs_expert_review");
  });
  it("R4: same road review with modality; opposite direction do not transfer with warning; unknown/contested review", () => {
    const same = ruleById("R4").apply(base);
    expect(same.verdict).toBe("needs_expert_review");
    expect(same.reason).toContain("antisense");
    const opp = ruleById("R4").apply({ ...base, relation: "opposite direction" });
    expect(opp.verdict).toBe("do_not_transfer");
    expect(opp.warning).toBe(true);
    expect(ruleById("R4").apply({ ...base, relation: "unknown" }).verdict).toBe("needs_expert_review");
    expect(ruleById("R4").apply({ ...base, relation: "contested" }).verdict).toBe("needs_expert_review");
  });
  it("R5: model never transfers; assay design reviewable on the same road", () => {
    expect(ruleById("R5").apply(base).verdict).toBe("needs_expert_review");
    expect(ruleById("R5").apply({ ...base, relation: "different road" }).verdict).toBe("do_not_transfer");
  });
  it("R6: same road and high similarity only", () => {
    expect(ruleById("R6").apply(base).verdict).toBe("needs_expert_review");
    expect(ruleById("R6").apply({ ...base, simBand: "medium" }).verdict).toBe("do_not_transfer");
    expect(ruleById("R6").apply({ ...base, relation: "opposite direction" }).verdict).toBe("do_not_transfer");
  });
  it("R7 never asserts a verdict", () => {
    expect(ruleById("R7").apply(base).verdict).toBeNull();
  });
});
