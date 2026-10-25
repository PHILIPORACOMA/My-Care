# ADR-0008: Lexicon matching rules: negations, and one extra word in a phrase

## Status

Accepted 2026-10-25 (Philipo approved the plan, one extra word). Implemented
in `packages/lexicon-matcher`. **No manuscript amendment**: the NLP layer stays
a deterministic, vocabulary-free lookup against the published lexicon, and it
still never assigns a tier (CLAUDE.md non-negotiable #2).

## Context

The matcher finds lexicon phrases anywhere in a patient's text, tolerating
typos, split words and run-together words. Two problems surfaced on
2026-10-25 (BUILD-LOG 9k):

1. **A positive read as a negation.** Comparing with the spaces removed gives a
   12-letter join two edits of allowance. "naay hilanat" ("I have a fever") is
   two edits from the negation "walay hilanat", so fever was recorded absent.
   That can under-triage, whatever lexicon is published.
2. **Phrases break on one extra word.** "grabe **kaayo** nga sakit sa tiyan"
   matched nothing, although the lexicon held "grabe nga sakit sa tiyan".
   Patients add intensifiers and particles.

## Decision

**Negations are strict.** A negation term matches word for word (each word
within its own allowance) or as an exact run-together join. It never uses
the fuzzy joined comparison and never takes an extra word. Missing a negation
can only escalate; inventing one can under-triage.

**A positive phrase of two or more words may take exactly one extra word**
between its words, when:

- the extra word is not one any term matches by itself (it cannot swallow a
  symptom of its own);
- the whole span sits inside one clause. `tokenizeClauses` groups words at
  `. , ; : ! ? …` and line breaks, which needs no vocabulary;
- every phrase word is within its own allowance, with no joined comparison;
- none of the span was claimed by an earlier, higher-priority term.

**Order.** Terms go in priority order, as before: negations, then longer
phrases, then longer joins. Each term tries itself as written, then with
one extra word, before any shorter term goes. So "grabe kaayo nga sakit sa
tiyan" is the longer, more severe phrase rather than the plain
"sakit sa tiyan" inside it.

## Consequences

- **The extra word can be an intensifier.** "sakit **kaayo** akong ulo" ("my
  head hurts a lot") matches "sakit akong ulo", so it lands on the code that
  phrase names. Severity carried only by the skipped word is lost. The remedy
  is lexicon content: the reviewed lexicon should list intensified forms
  under the code they belong to, and those win as the longer exact match.
  Clinical review should look for this.
- More text matches, so a false match is likelier. Two extra words were
  considered and rejected for that reason.
- Server replay is untouched. Only symptom codes leave the device, never
  text, so no stored session changes meaning.

## Traceability

UT-003 (lexicon matching), UT-004 (negation). Tests:
`packages/lexicon-matcher/src/match.test.ts`.
