/**
 * Quote verification (SPEC section 8.1). Both the quote and the source text are
 * normalized for whitespace and typographic punctuation, then the quote must be
 * an exact substring. Offsets are returned into the normalized source text.
 */
export function normalizeText(s: string): string {
  return s
    .replace(/[‘’‚‛′]/g, "'")
    .replace(/[“”„‟″]/g, '"')
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type VerifiedQuote = { text: string; start: number; end: number };

export function verifyQuote(quote: string, sourceText: string): VerifiedQuote | null {
  const q = normalizeText(quote);
  const src = normalizeText(sourceText);
  if (!q || q.length < 8) return null;
  let start = src.indexOf(q);
  if (start < 0) {
    // Case-insensitive fallback: still an exact character sequence, only letter case differs.
    start = src.toLowerCase().indexOf(q.toLowerCase());
    if (start < 0) return null;
  }
  const end = start + q.length;
  return { text: src.slice(start, end), start, end };
}

/** Check stored offsets against the (normalized) source text. */
export function offsetsMatch(quote: { text: string; start: number; end: number }, sourceText: string): boolean {
  const src = normalizeText(sourceText);
  return src.slice(quote.start, quote.end) === normalizeText(quote.text);
}
