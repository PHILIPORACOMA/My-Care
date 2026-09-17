import type { LanguageCode, LexiconTerm } from "@mycare/ruleset";
import { allowedEdits, editDistance } from "./distance.js";
import { tokenize } from "./normalize.js";

/**
 * The on-device NLP layer (Table 30 module 3, UT-003, UT-004).
 *
 * It proposes symptom codes from a patient's free text by matching it against
 * the published lexicon. **It never assigns a tier** — CLAUDE.md
 * non-negotiable #2. Its output goes to the rule engine, which alone decides.
 *
 * Everything it knows comes from the lexicon it is given. It contains no
 * vocabulary of its own: not a single Cebuano or Tagalog word, not even a
 * negation cue. Negation is lexicon content — a term with `isNegation`, such as
 * the manuscript's own "walay hilanat" — so what counts as "no fever" is
 * authored and clinically reviewed, never guessed by this code.
 *
 * Pure and deterministic, like the engine: the same text and lexicon give the
 * same matches on every device.
 */

export interface SymptomMatch {
  symptomCode: string;
  /** True only when every mention of the symptom was a negation term. */
  negated: boolean;
  /** The lexicon entry that fired — bundle vocabulary, never the patient's words. */
  matchedTerm: { term: string; language: LanguageCode };
}

interface PreparedTerm {
  entry: LexiconTerm;
  tokens: string[];
  joined: string;
  order: number;
}

interface Hit {
  entry: LexiconTerm;
  start: number;
}

export function matchSymptoms(text: string, lexicon: readonly LexiconTerm[]): SymptomMatch[] {
  const tokens = tokenize(text);
  if (tokens.length === 0) {
    return [];
  }

  const consumed = new Array<boolean>(tokens.length).fill(false);
  const hits: Hit[] = [];

  for (const term of prepare(lexicon)) {
    for (let start = 0; start < tokens.length; start++) {
      const width = matchAt(tokens, consumed, start, term);
      if (width > 0) {
        for (let i = start; i < start + width; i++) {
          consumed[i] = true;
        }
        hits.push({ entry: term.entry, start });
      }
    }
  }

  return combine(hits);
}

/**
 * Negation terms are tried first, then longer terms before shorter ones. So in
 * "walay hilanat" the negation phrase claims both words before the bare
 * "hilanat" can, and a multi-word term beats any single word inside it.
 */
function prepare(lexicon: readonly LexiconTerm[]): PreparedTerm[] {
  return lexicon
    .map((entry, order) => {
      const tokens = tokenize(entry.term);
      return { entry, tokens, joined: tokens.join(""), order };
    })
    .filter((term) => term.tokens.length > 0)
    .sort(
      (a, b) =>
        Number(b.entry.isNegation) - Number(a.entry.isNegation) ||
        b.tokens.length - a.tokens.length ||
        b.joined.length - a.joined.length ||
        a.order - b.order
    );
}

/**
 * Tries the term at `start` across a few input widths, so a word the patient
 * split ("sip on") or ran together still meets its lexicon form. Returns the
 * number of input tokens matched, or 0.
 */
function matchAt(tokens: string[], consumed: boolean[], start: number, term: PreparedTerm): number {
  const n = term.tokens.length;
  const widths = [n, n + 1, n - 1].filter((w) => w >= 1);

  for (const width of widths) {
    if (start + width > tokens.length) {
      continue;
    }
    if (consumed.slice(start, start + width).some(Boolean)) {
      continue;
    }

    const window = tokens.slice(start, start + width);

    // Word for word first: each word within its own allowance, which keeps
    // short words exact even inside a longer phrase.
    if (width === n && window.every((token, i) => withinAllowance(token, term.tokens[i]!))) {
      return width;
    }

    // Then as joined strings, for split or run-together words. Only for
    // targets long enough to have an edit allowance, or an exact join.
    if (withinAllowance(window.join(""), term.joined)) {
      return width;
    }
  }

  return 0;
}

function withinAllowance(input: string, target: string): boolean {
  if (input === target) {
    return true;
  }
  const max = allowedEdits(target.length);
  return max > 0 && editDistance(input, target, max) <= max;
}

/**
 * One result per symptom code, in order of first mention.
 *
 * If a symptom is mentioned both negated and plainly, it is reported present.
 * Missing a symptom the patient does have can under-triage; reporting one they
 * do not have can only escalate — the same direction the rule engine's
 * fail-safe runs (ADR-0001).
 */
function combine(hits: Hit[]): SymptomMatch[] {
  const byCode = new Map<string, { first: number; positive?: LexiconTerm; negative?: LexiconTerm }>();

  for (const hit of [...hits].sort((a, b) => a.start - b.start)) {
    const code = hit.entry.symptomCode;
    const current = byCode.get(code) ?? { first: hit.start };
    if (hit.entry.isNegation) {
      current.negative ??= hit.entry;
    } else {
      current.positive ??= hit.entry;
    }
    byCode.set(code, current);
  }

  return [...byCode.entries()]
    .sort((a, b) => a[1].first - b[1].first)
    .map(([symptomCode, { positive, negative }]) => {
      const entry = (positive ?? negative)!;
      return {
        symptomCode,
        negated: positive === undefined,
        matchedTerm: { term: entry.term, language: entry.language },
      };
    });
}
