import { describe, it, expect } from "vitest";
import { computeLadder, aheadOn, highestPhase } from "@/lib/ladder";
import type { Condition, Study } from "@/lib/schemas";

const cond = (over: Partial<Condition> = {}): Condition => ({
  id: "cond:G2P00001",
  g2pId: "G2P00001",
  name: "X-related disorder",
  synonyms: [],
  geneId: "gene:HGNC:1",
  geneSymbol: "X",
  allelicRequirementRaw: "monoallelic_autosomal",
  allelicClass: "monoallelic",
  mechanism: "loss of function",
  mechanismSupport: "inferred",
  confidence: "definitive",
  roadId: "road:monoallelic:lof",
  depth: "deep",
  publications: [],
  curatedPhenotypeIds: [],
  evidenceIds: ["ev:g2p:G2P00001"],
  phenotypeMatch: { method: "hpoa_xref", termCount: 10 },
  thinAnnotation: false,
  sameGeneOtherMechanism: [],
  supportingClaims: [],
  ...over,
});

const study = (over: Partial<Study>): Study => ({
  id: "NCT00000001",
  briefTitle: "t",
  status: "RECRUITING",
  studyType: "INTERVENTIONAL",
  phases: ["PHASE2"],
  conditions: [],
  interventions: [],
  officials: [],
  hits: [],
  conditionIds: ["cond:G2P00001"],
  evidenceIds: ["ev:ctgov:NCT00000001:role"],
  retrievedAt: "2026-10-03",
  classification: { aboutCondition: true, role: "interventional_targeted", modality: "antisense", quote: "q", quoteVerified: true },
  ...over,
});

const searched = { studies: true, orgs: true, grants: true, literature: true, approved: true };

describe("computeLadder", () => {
  it("marks gene link and mechanism from curated fields", () => {
    const l = computeLadder({ condition: cond(), studies: [], orgs: [], grants: [], models: null, approved: [], searched, currentFiscalYear: 2026 });
    expect(l[0].status).toBe("found");
    expect(l[1].status).toBe("found");
    expect(l[1].flags).toContain("support: inferred");
    const l2 = computeLadder({ condition: cond({ confidence: "limited", mechanism: "undetermined" }), studies: [], orgs: [], grants: [], models: null, approved: [], searched, currentFiscalYear: 2026 });
    expect(l2[0].status).toBe("not_found");
    expect(l2[1].status).toBe("not_found");
  });
  it("uses not_searched for shallow conditions on milestones 3-8", () => {
    const l = computeLadder({ condition: cond({ depth: "shallow" }), studies: [], orgs: [], grants: [], searched, currentFiscalYear: 2026 });
    expect(l.slice(2).every((m) => m.status === "not_searched")).toBe(true);
  });
  it("finds a targeted trial with its highest phase and flags a single study", () => {
    const l = computeLadder({ condition: cond(), studies: [study({})], orgs: [], grants: [], models: null, approved: [], searched, currentFiscalYear: 2026 });
    expect(l[6].status).toBe("found");
    expect(l[6].detail).toContain("phase 2");
    expect(l[6].flags).toContain("single study");
    expect(l[6].evidenceIds).toEqual(["ev:ctgov:NCT00000001:role"]);
  });
  it("counts registry and natural history studies for milestone 4 and not symptomatic trials", () => {
    const l = computeLadder({ condition: cond(), studies: [study({ id: "NCT00000002", classification: { aboutCondition: true, role: "natural_history", modality: "none", quote: "q", quoteVerified: true } })], orgs: [], grants: [], models: null, approved: [], searched, currentFiscalYear: 2026 });
    expect(l[3].status).toBe("found");
    expect(l[6].status).toBe("not_found");
    expect(l[6].sourcesSearched.length).toBeGreaterThan(0);
  });
  it("only counts grants in the last two fiscal years", () => {
    const g = { id: "grant:1", projectNumber: "1", title: "t", fiscalYears: [2023], piNames: [], conditionIds: ["cond:G2P00001"], queryTerms: [], evidenceIds: ["ev:reporter:1"], url: "https://reporter.nih.gov/project-details/1" };
    const l = computeLadder({ condition: cond(), studies: [], orgs: [], grants: [g], models: null, approved: [], searched, currentFiscalYear: 2026 });
    expect(l[5].status).toBe("not_found");
    const l2 = computeLadder({ condition: cond(), studies: [], orgs: [], grants: [{ ...g, fiscalYears: [2025] }], models: null, approved: [], searched, currentFiscalYear: 2026 });
    expect(l2[5].status).toBe("found");
  });
  it("aheadOn lists milestones where the neighbor has found and the focal has not_found", () => {
    const focal = computeLadder({ condition: cond(), studies: [], orgs: [], grants: [], models: null, approved: [], searched, currentFiscalYear: 2026 });
    const nb = computeLadder({ condition: cond({ id: "cond:G2P00002" }), studies: [study({ conditionIds: ["cond:G2P00002"] })], orgs: [], grants: [], models: { count: 4, topPmids: ["1"], evidenceId: "ev:pubmed:models:X" }, approved: [], searched, currentFiscalYear: 2026 });
    expect(aheadOn(focal, nb)).toEqual([5, 7]);
  });
  it("highestPhase orders phases", () => {
    expect(highestPhase(["PHASE1", "PHASE3", "PHASE2"])).toBe("PHASE3");
    expect(highestPhase([])).toBeUndefined();
  });
});
