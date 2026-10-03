/**
 * Information content and simGIC (SPEC section 9: S3). Pure functions so they can be unit-tested
 * on a tiny hand-built ontology.
 */

/** Ancestor closure of a set of terms (each term plus all ancestors), given a parent lookup. */
export function closureOf(terms: Iterable<string>, parentsOf: (t: string) => string[]): Set<string> {
  const out = new Set<string>();
  const stack = [...terms];
  while (stack.length) {
    const t = stack.pop()!;
    if (out.has(t)) continue;
    out.add(t);
    for (const p of parentsOf(t)) if (!out.has(p)) stack.push(p);
  }
  return out;
}

/** Information content: -log(p) with p = share of annotated entities carrying the term or a descendant. */
export function informationContent(annotated: Iterable<Set<string>>, parentsOf: (t: string) => string[]): Map<string, number> {
  const counts = new Map<string, number>();
  let n = 0;
  for (const set of annotated) {
    n++;
    for (const a of closureOf(set, parentsOf)) counts.set(a, (counts.get(a) ?? 0) + 1);
  }
  const ic = new Map<string, number>();
  for (const [t, c] of counts) ic.set(t, -Math.log(c / n));
  return ic;
}

/** simGIC between two ancestor-closed sets. Returns the similarity and the shared terms. */
export function simGIC(a: Set<string>, b: Set<string>, icOf: (t: string) => number): { sim: number; shared: string[] } {
  let inter = 0;
  let union = 0;
  const shared: string[] = [];
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const t of small) {
    const w = icOf(t);
    union += w;
    if (large.has(t)) {
      inter += w;
      if (w > 0) shared.push(t);
    }
  }
  for (const t of large) if (!small.has(t)) union += icOf(t);
  return { sim: union > 0 ? inter / union : 0, shared };
}
