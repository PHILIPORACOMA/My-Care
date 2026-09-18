import type { LexiconTerm } from "@mycare/ruleset";

export interface LexiconMatch {
  symptomCode: string;
  isNegation: boolean;
}

/** Keyed by lowercased term text. Multiple terms (different symptoms, or a positive and a negated form) may share a key. */
export type LexiconIndex = Map<string, LexiconMatch[]>;

export function buildLexiconIndex(terms: LexiconTerm[]): LexiconIndex {
  const index: LexiconIndex = new Map();
  for (const term of terms) {
    const key = term.term.trim().toLowerCase();
    const matches = index.get(key) ?? [];
    matches.push({ symptomCode: term.symptomCode, isNegation: term.isNegation });
    index.set(key, matches);
  }
  return index;
}
