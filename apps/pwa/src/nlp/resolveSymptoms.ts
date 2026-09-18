import type { LexiconIndex } from "./lexicon.js";

/**
 * Free-text resolution via exact, case-insensitive, whole-phrase matching:
 * tokenize the input into words, then at each position try the longest
 * lexicon phrase that matches first before falling back to shorter ones
 * (greedy longest-match). This is what lets a specific phrase like
 * "persistent fever" take precedence over a generic single-word term like
 * "fever" mapped to a different, milder symptom code — see
 * packages/ruleset's v1-lexicon-draft.ts for how that's used deliberately.
 * A negated term suppresses its symptom code even if a positive mention of
 * the same code appears elsewhere in the text.
 *
 * No stemming, spelling correction, or synonym expansion beyond what's in
 * the lexicon index — a misspelled or unlisted phrase simply won't match.
 */
export function resolveSymptoms(freeText: string, index: LexiconIndex): string[] {
  const tokens = tokenize(freeText);
  const positive = new Set<string>();
  const negated = new Set<string>();
  const maxPhraseLength = Math.max(1, ...[...index.keys()].map((key) => key.split(" ").length));

  let i = 0;
  while (i < tokens.length) {
    let matchedLength = 0;
    for (let length = Math.min(maxPhraseLength, tokens.length - i); length >= 1; length--) {
      const phrase = tokens.slice(i, i + length).join(" ");
      const matches = index.get(phrase);
      if (matches) {
        for (const match of matches) {
          if (match.isNegation) {
            negated.add(match.symptomCode);
          } else {
            positive.add(match.symptomCode);
          }
        }
        matchedLength = length;
        break;
      }
    }
    i += matchedLength > 0 ? matchedLength : 1;
  }

  return [...positive].filter((code) => !negated.has(code));
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);
}
