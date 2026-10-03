import { describe, it, expect } from "vitest";
import { closureOf, informationContent, simGIC } from "@/lib/similarity";

// Tiny ontology: root -> {A, B}; A -> {A1, A2}; B -> {B1}
const parents: Record<string, string[]> = { A: ["root"], B: ["root"], A1: ["A"], A2: ["A"], B1: ["B"], root: [] };
const p = (t: string) => parents[t] ?? [];

describe("closureOf", () => {
  it("includes the term and all ancestors", () => {
    expect([...closureOf(["A1"], p)].sort()).toEqual(["A", "A1", "root"]);
  });
});

describe("informationContent", () => {
  it("is -log(p) over annotated entities with descendant propagation", () => {
    const annotated = [new Set(["A1"]), new Set(["A2"]), new Set(["B1"]), new Set(["A1", "B1"])];
    const ic = informationContent(annotated, p);
    expect(ic.get("root")).toBeCloseTo(0);
    expect(ic.get("A")).toBeCloseTo(-Math.log(3 / 4));
    expect(ic.get("A1")).toBeCloseTo(-Math.log(2 / 4));
    expect(ic.get("B1")).toBeCloseTo(-Math.log(2 / 4));
    expect(ic.get("A2")).toBeCloseTo(-Math.log(1 / 4));
  });
});

describe("simGIC", () => {
  const icOf = (t: string) => ({ root: 0, A: 1, B: 1, A1: 2, A2: 2, B1: 2 })[t] ?? 0;
  it("is 1 for identical sets and 0 for sets sharing only zero-IC terms", () => {
    const x = closureOf(["A1"], p);
    expect(simGIC(x, x, icOf).sim).toBe(1);
    const y = closureOf(["B1"], p);
    expect(simGIC(x, y, icOf).sim).toBe(0);
  });
  it("weights shared ancestors by information content", () => {
    const x = closureOf(["A1"], p); // root, A, A1 -> IC sum 3
    const y = closureOf(["A2"], p); // root, A, A2 -> IC sum 3
    const { sim, shared } = simGIC(x, y, icOf);
    // intersection {root, A} = 1; union {root, A, A1, A2} = 5
    expect(sim).toBeCloseTo(1 / 5);
    expect(shared).toEqual(["A"]);
  });
});
