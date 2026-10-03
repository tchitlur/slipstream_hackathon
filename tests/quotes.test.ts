import { describe, it, expect } from "vitest";
import { normalizeText, verifyQuote, offsetsMatch } from "@/lib/quotes";

describe("quote verification", () => {
  const source = "Inclusion:\n\n* Patients with a “documented” loss‑of‑function   variant.\n* Age ≥ 2 years.";
  it("normalizes whitespace and typographic punctuation", () => {
    expect(normalizeText("“a”  –  ‘b’")).toBe('"a" - \'b\'');
  });
  it("accepts a verbatim quote with different quotes and dashes and returns offsets", () => {
    const q = verifyQuote('Patients with a "documented" loss-of-function variant.', source);
    expect(q).not.toBeNull();
    expect(q!.text).toBe('Patients with a "documented" loss-of-function variant.');
    expect(offsetsMatch(q!, source)).toBe(true);
  });
  it("rejects a paraphrase", () => {
    expect(verifyQuote("Patients who have a loss of function variant", source)).toBeNull();
  });
  it("rejects very short quotes", () => {
    expect(verifyQuote("Age", source)).toBeNull();
  });
  it("detects tampered offsets", () => {
    const q = verifyQuote("Age ≥ 2 years.", source)!;
    expect(offsetsMatch({ ...q, start: q.start + 1 }, source)).toBe(false);
  });
});
