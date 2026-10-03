import { describe, it, expect } from "vitest";
import { mergeInvestigators, normalizeName } from "@/lib/investigators";

const rec = (kind: "grant" | "study" | "paper", id: string, conditionIds: string[] = ["cond:G2P00001"]) => ({ kind, id, url: `https://example.org/${id}`, role: "pi", conditionIds });

describe("investigator merge rules", () => {
  it("normalizes 'Last, First' and 'First Last' forms", () => {
    expect(normalizeName("SMITH, JANE").surname).toBe("smith");
    expect(normalizeName("SMITH, JANE").initial).toBe("j");
    expect(normalizeName("Jane Q Smith").surname).toBe("smith");
    expect(normalizeName("Jane Q Smith, MD").surname).toBe("smith");
  });
  it("merges same surname, initial and organization", () => {
    const out = mergeInvestigators([
      { name: "SMITH, JANE", org: "University of X", record: rec("grant", "R01A") },
      { name: "Jane Smith", org: "University of X", record: rec("study", "NCT1") },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].records).toHaveLength(2);
  });
  it("merges on the same linked record even without an organization", () => {
    const out = mergeInvestigators([
      { name: "SMITH, JANE", org: "University of X", record: rec("study", "NCT1") },
      { name: "Jane Smith", record: rec("study", "NCT1") },
    ]);
    expect(out).toHaveLength(1);
  });
  it("keeps apart same surname and initial at different organizations with no shared record", () => {
    const out = mergeInvestigators([
      { name: "Jane Smith", org: "University of X", record: rec("grant", "R01A") },
      { name: "J Smith", org: "Hospital Y", record: rec("grant", "R01B") },
    ]);
    expect(out).toHaveLength(2);
  });
  it("keeps apart different first initials at the same organization", () => {
    const out = mergeInvestigators([
      { name: "Jane Smith", org: "University of X", record: rec("grant", "R01A") },
      { name: "Robert Smith", org: "University of X", record: rec("grant", "R01B") },
    ]);
    expect(out).toHaveLength(2);
  });
  it("paper last authors without an organization stay separate from PIs unless the record is shared", () => {
    const out = mergeInvestigators([
      { name: "Jane Smith", org: "University of X", record: rec("grant", "R01A") },
      { name: "Smith, J", record: rec("paper", "123") },
    ]);
    expect(out).toHaveLength(2);
  });
});
