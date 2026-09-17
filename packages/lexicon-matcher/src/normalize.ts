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
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // Apostrophe, right single quote, hyphen variants, ASCII hyphen (last, so
    // it is literal rather than a range).
    .replace(/(\p{L})['’‐‑-](?=\p{L})/gu, "$1")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenize(text: string): string[] {
  const normalized = normalize(text);
  return normalized === "" ? [] : normalized.split(" ");
}
