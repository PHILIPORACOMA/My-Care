# ADR-0006: Ruleset authoring, versioning, review, publish and rollback

## Status

Accepted 2026-09-17. Implemented in `apps/api`, verified against MySQL 8 —
Pest 136 passed, 512 assertions. **No manuscript amendment.**

## Context

Figure 39 is "the explainability centerpiece": rules as IF / AND / NOT, editable
thresholds and red-flag overrides, a versioned Tagalog/Cebuano lexicon, and
"changes are staged and then published". Table 30 names the module *Content
Versioning (Draft → Review → Publish)*, and Figure 11's admin workflow sends
every change through clinical review before deployment. UT-007 to UT-011 test
it.

Three schema facts constrained the design:

- `RULESET_VERSION.status` is a free `VARCHAR(15)`; the dictionary names no
  states.
- `RULE_CONDITION` (Table 10) has **no sequence column**, but a condition's
  `operator` combines it with the ones before it, so order changes meaning.
- `SYMPTOM_CODE` (Table 6) is **not version-scoped**.

## Decision

### 1. Every save writes a whole new version

UT-010 says "each save creates a new version; prior versions remain
retrievable", and it is taken literally. `PUT
/console/ruleset-versions/{id}/content` validates the full content and writes a
new `draft` version (`VersionWriter`); the old draft becomes `superseded`.
Nothing is ever edited in place. Nothing that went to review or was published is ever deleted.

**Amended 2026-11-17: who reviewed and approved a version.** Publishing now
also asks for the reviewer, as free text of up to 100 characters. Philipo asked
for it so that each published version says "Reviewed and approved by: …". Rules:

- It is required. The API refuses to publish without it, as it refuses without
  the clinical-review attestation. Spaces alone do not count.
- It is a **name only with that person's consent, otherwise a role** ("RHU
  nurse, Carcar"). The first appraiser did not consent to be named. A name is
  personal data under RA 10173, and the audit log keeps it for good.
- RULESET_VERSION (Table 7) has no column for it, and the project takes no
  manuscript amendments. So it is one audit entry, `clinical_review`, whose
  `old_value` is `{"reviewed_by": "…"}`. `RulesetLifecycle` writes it through
  `Recorder` at publish, as it already does for `draft_saved` and `rollback`
  provenance. It is never edited.
- A rollback copies the original reviewer onto the restored version, adding
  `carried_from`, because the content was reviewed when it was first published.
- It is shown in the console only: on the version page and in the version list.
  Phones never receive it. A version published before this shows "not recorded".

**Amended 2026-11-15: a draft can be deleted.** The console's Delete button removes a
version whose status is `draft`: a "New draft" clicked by mistake, an import nobody
wants, unfinished work. Philipo asked for it. It does not touch UT-010, which is
about saves: a version that was saved over (`superseded`) is a prior version and
stays retrievable. Rules:

- Only `draft` can be deleted. `in_review` must be returned to draft first;
  `superseded`, `published` and `retired` are never deleted. A draft is never
  served to a device, and no session points at one.
- The rules, terms, thresholds, questions and tips it held go with it (the foreign
  keys cascade). Those rows are not audited one by one, so the audit entry
  `draft_deleted` records the label, the version it was based on and how many of
  each it held. The content itself is not kept.
- The label is reserved. `VersionWriter::nextLabel` also counts labels in
  `draft_deleted` entries, so a deleted v7 is never reused and the audit log never
  has two different v7s.
- The list hides `superseded` and `retired` behind "Show older versions" so the
  history stays retrievable without cluttering the page.

That one rule resolves two gaps without an amendment:

- **Condition order.** Conditions are only ever inserted, in the order the author
  arranged them, into a version that never changes afterwards. The primary key
  *is* the sequence. Reordering in the console is delete-and-reinsert by
  construction.
- **Reconstruction (Figure 41).** A session's `ruleset_version_id` always points
  at content that has not changed since the session was triaged.

### 2. States

| State | Meaning |
|---|---|
| `draft` | editable; saving creates a new version |
| `superseded` | a draft that was saved over; read-only history |
| `in_review` | submitted for clinical review; frozen |
| `published` | the version devices receive; **exactly one at a time** |
| `retired` | was published, since replaced; sessions still replay against it |

Transitions live only in `Domain/Ruleset/RulesetLifecycle`, under row locks:
draft → in_review (requires at least one active rule) → published, or
in_review → draft when review asks for changes.

### 3. Publishing requires an attestation of clinical review

The system cannot verify a clinician's signature, and `USER` has no reviewer
role. Publishing therefore requires `clinicalReviewConfirmed: true`, and the
audit log records which super-admin gave it. The attestation is the honest
limit of what software can enforce here.

### 4. Rollback publishes a copy

Rolling back to a retired version copies its content into a new version that is
published at once (it was clinically reviewed when first published). The old
row's `published_at` stays history, devices see a new label, and a `rollback`
audit entry records `restored_from`.

### 5. Rule expressions are generated

`TRIAGE_RULE.expression` is rendered from the conditions on every save
(`ExpressionFormatter`), mirroring the engine's left-to-right fold. If an author
could type it, the explanation shown to a health worker could describe a rule
that is not the one that fired.

### 6. Validation guards the engine's silent failure modes

`ContentValidator` enforces Data Dictionary widths and the invariants the engine
assumes but does not check — the ones that produce a *wrong tier* rather than a
crash: unknown codes or threshold keys, a condition testing both or neither of
symptom and attribute, a non-numeric threshold value (the engine compares with
`Number()`), and a red-flag answer outside the allowed answers.

**Language variants of a clarification question.** The engine finds a question
by `questionKey` alone — the first in bundle order. If the Cebuano and English
versions listed the red-flag answer in different positions, a red-flag answer
given in one language could be missed. So every variant of a key must share its
symptom, answer count and red-flag *position*, and the PWA submits the answer at
the chosen position from the first variant. This is a convention on top of the
existing contract, not an engine change.

*Amended 2026-11-16.* "First variant" is now fixed: `BundleAssembler` lists
each key's English variant first, then the others alphabetically. It used to
sort plainly by language, which put Cebuano first. That variant's answers are
what the phone submits, what `CLARIFICATION_ANSWER.answer` stores
(VARCHAR(50)), and what a rule's text threshold is compared with (ADR-0001).
So `ContentValidator` holds that variant's answers to 50 characters and the
others to 100, because `allowed_answers` is a JSON column. A Tagalog or
Cebuano answer may therefore run longer than the English. Nothing published
changed: v1 has no questions, and no v2 version has been live.

### 7. Symptom codes lock once a frozen version uses them

Because Table 6 is global, editing a code would silently change published
versions. A code becomes immutable once any `in_review`, `published` or
`retired` version references it; new codes can always be added.

*Amended 2026-11-16.* One change is still accepted on a locked code:
`needs_clarification` from off to on, through the console or an import. It
lets a later version add a follow-up question to an existing presentation
(Batch 2 Part C on six v1 codes). Frozen versions behave as before, because
the phone asks only that version's own questions. The switch is refused if a
frozen version already holds a question for the code, since that version would
start asking it. Off again is refused, because it would silence a frozen
version's questions. The change is audited like any other update.

### 8. Audit scope

The version row is audited (created, every status change). Provenance the
observer cannot see — `draft_saved` / `draft_started` with `based_on`, and
`rollback` with `restored_from` — is added through `Recorder` by the lifecycle
service. The hundreds of content rows a save writes are inserted without model
events: auditing each one would bury the entries Figure 41 exists to show, and
the version they belong to is the immutable snapshot the audit entry points at.

### 9. v1 gets in through an importer, as a draft

`npm run export:v1 -w @mycare/ruleset` writes the v1 bundle as JSON;
`php artisan mycare:ruleset:import <file>` (or the console's import) loads it as
a **draft**. Encoded in the repository is not the same as clinically reviewed.
Verified: the real v1 file imports with 23 rules, 9 of them emergency.

## Consequences

- `GET /api/v1/ruleset/current` no longer has to return 503 on a fresh install:
  import, review and publish v1 from the console.
- Version labels are `v1`, `v2`, … in creation order, so a published label can
  skip numbers (drafts consume them). Devices only ever compare labels for
  equality, so gaps are harmless.
- The CI `api` job needs Node to export v1 for the import test; until the
  workflow is updated the test skips there (Milestone 9).

## Traceability

- UT-007, UT-008, UT-009 (authoring), UT-010, UT-011 →
  `tests/Feature/Console/RulesetLifecycleTest.php`
- Engine precedence → `docs/adr/0001-triage-resolution.md`
