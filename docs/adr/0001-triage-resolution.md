# ADR-0001: Triage resolution precedence

## Status

Accepted.

## Context

`packages/triage-engine` assigns one of three tiers — `home`, `rhu`,
`emergency` — to a patient's reported symptoms. Because the result can
delay or accelerate a person's access to care, the resolution logic must be
deterministic, auditable, and biased toward caution rather than toward
convenience. This mirrors the manuscript's theoretical grounding in
rule-based clinical decision support (Shortliffe & Buchanan, 1975; Berner &
La Lande, 2007): the engine approximates clinical reasoning through
explicitly authored IF/AND/NOT rules rather than a probabilistic model, so
that any two runs on the same input always agree, and any single result can
be traced back to the exact rule (or override) that produced it.

A session can, in principle, satisfy more than one signal at once — a
red-flag answer to a follow-up question, a severity threshold crossed by a
reported value, and one or more matching rules. Some ordering of these
signals has to win, and that ordering has to be fixed in one place rather
than re-decided ad hoc per rule.

## Decision

`evaluate(input, bundle)` resolves a tier in this fixed order, stopping at
the first step that produces a result:

1. **Red-flag clarification.** If any of the patient's clarification
   answers equals that question's `redFlagAnswer`, the result is
   `emergency` immediately. This models the "Severe, spreading to arm or
   jaw" answer pattern (Figure 23) — a single deliberate answer to a
   follow-up question is treated as unambiguous enough to skip everything
   else.
2. **`is_override` severity threshold.** If a `SeverityThreshold` marked
   `isOverride` is crossed by a reported attribute (e.g. a duration or
   count past its cutoff), the result is that threshold's `tier`
   immediately, without consulting the rule set.
3. **Highest tier among matching rules.** Every active `TriageRule` whose
   conditions are satisfied by the input is a candidate. The tier ranking
   is `emergency > rhu > home`; the highest-ranked matching tier wins. If
   more than one matching rule shares that tier, the rule with the lower
   `priority` number wins — `priority` is a stable tie-break, not a
   competing precedence signal.
4. **`rhu` fail-safe default.** If nothing matched at all, the result is
   `rhu` — never `home`. An unrecognized or ambiguous presentation is
   treated as worth a health-worker's judgment, not dismissed as safe to
   manage alone.

Steps 1–2 exist specifically to let a single unambiguous signal override an
otherwise-lower-tier rule match; step 3 never gets a chance to under-triage
past them. Step 4 exists so that a gap in rule coverage fails toward more
care, not less.

## Consequences

- `evaluate()` must stay pure (`packages/triage-engine` has zero runtime
  dependencies, no `Date.now()`, no `Math.random()`, synchronous) so that
  the same input and bundle version always reproduce the same tier — this
  is what makes a past result reconstructible from the ruleset version
  that was in force at the time (Figure 41, audit log).
- Authoring a new rule or threshold never needs to touch this precedence
  order; only the content of `bundle.rules`, `bundle.severityThresholds`,
  and `bundle.clarificationQuestions` changes.
- A rule set with a gap — no rule covers some reported symptom — degrades
  safely to `rhu`, not silently to `home`.

## Clarification-to-attribute wiring

`CLARIFICATION_QUESTION` (Table 15) has no `attribute` column, so there was
no stated way for a patient's answer to a follow-up question (e.g. "how many
days have you had the fever?") to populate a `RuleCondition` or
`SeverityThreshold` comparison. Rather than add a column — which would
diverge from Table 15 as written and require a manuscript amendment —
`evaluate()` reuses `ClarificationQuestion.questionKey` as the attribute
name directly: a question keyed `fever_duration_days` feeds
`attributes["fever_duration_days"]` when answered. Whoever authors a
clarification question is responsible for picking a `question_key` that
matches the `attribute`/`SeverityThreshold.key` it's meant to feed. Explicit
`TriageInput.attributes` are applied first, so a clarification answer
overrides a stale explicit value rather than the reverse.

## Traceability

This is the project's fixed resolution-precedence rule. Exercised by
`packages/triage-engine/src/evaluate.test.ts`; corresponds to UT-005 and
UT-009 in `docs/ut-matrix.md`.
