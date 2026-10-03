import { describe, it, expect } from "vitest";
import { groundingCheck } from "@/lib/brief";

describe("brief grounding check", () => {
  const pack = new Set(["ev:a", "ev:b"]);
  it("drops sentences with empty or unknown evidence ids, keeps the Who-we-are placeholder", () => {
    const out = {
      sections: [
        { heading: "Who we are", sentences: [{ text: "[placeholder]", evidenceIds: [] }] },
        {
          heading: "What we share",
          sentences: [
            { text: "grounded", evidenceIds: ["ev:a"] },
            { text: "ungrounded", evidenceIds: [] },
            { text: "hallucinated id", evidenceIds: ["ev:zzz"] },
            { text: "mixed", evidenceIds: ["ev:a", "ev:nope"] },
          ],
        },
      ],
      glossary: [],
    };
    const g = groundingCheck(out, pack);
    expect(g.sections[0].sentences).toHaveLength(1);
    expect(g.sections[1].sentences.map((s) => s.text)).toEqual(["grounded"]);
    expect(g.dropped).toBe(3);
    expect(g.total).toBe(5);
  });
  it("passes when at most a fifth are dropped", () => {
    const out = { sections: [{ heading: "What we share", sentences: [1, 2, 3, 4].map((i) => ({ text: `s${i}`, evidenceIds: ["ev:b"] })).concat([{ text: "bad", evidenceIds: [] }]) }], glossary: [] };
    const g = groundingCheck(out, pack);
    expect(g.dropped / g.total).toBeLessThanOrEqual(0.2);
  });
});
