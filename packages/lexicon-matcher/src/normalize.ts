/**
 * Text normalisation for lexicon matching (UT-002, UT-003).
 *
 * Patients type on phone keyboards in Cebuano, Tagalog and English, often
 * mixing them, with inconsistent hyphens, apostrophes, accents and spacing.
 * Normalisation removes the variation that carries no meaning so the matcher
 * compares like with like:
 *
 * - lower case;
 * - accents and tildes removed ("ñ" becomes "n", "é" becomes "e");
 * - hyphens and apostrophes inside a word are dropped, so "sip-on" and
 *   "sipon" become the same token — Table 31's own UT-003 example;
 * - any other punctuation separates words;
 * - runs of whitespace collapse.
 *
 * Pure and deterministic: no locale-dependent behaviour.
 */
export function normalize(text: string): string {
  return joinWords(text)
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Every step of `normalize` before punctuation becomes a word break. */
function joinWords(text: string): string {
  return (
    text
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      // Apostrophe, right single quote, hyphen variants, ASCII hyphen (last, so
      // it is literal rather than a range).
      .replace(/(\p{L})['’‐‑-](?=\p{L})/gu, "$1")
  );
}

/**
 * The same tokens as `tokenize`, grouped by clause: sentence and clause
 * punctuation (. , ; : ! ? … and line breaks) starts a new group. Lets the
 * matcher keep a skipped word from bridging two clauses, without knowing a
 * single word of any language.
 */
export function tokenizeClauses(text: string): string[][] {
  return joinWords(text)
    .split(/[.,;:!?…\n\r]+/u)
    .map((clause) => tokenize(clause))
    .filter((clause) => clause.length > 0);
}

export function tokenize(text: string): string[] {
  const normalized = normalize(text);
  return normalized === "" ? [] : normalized.split(" ");
}
