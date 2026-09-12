# Data Dictionary (Tables 5–24)

Verbatim transcription of the 20 entity tables in the capstone manuscript's
Data Dictionary, so no future session has to open the 22 MB `.docx`.

**Source:** `My Care Manuscript (2).docx`, 22.3 MB, last modified 2026-08-19 —
the newest manuscript revision. Table numbers are taken from the manuscript's
own List of Tables, not inferred from document order. Transcribed 2026-09-12.

**This file is a copy, not an authority.** The manuscript is the specification.
If this file and the manuscript disagree, the manuscript wins and this file is
wrong — fix it here. If the *schema* and the manuscript disagree, that is a
defect in the schema or an amendment that has to be approved and recorded, not
something to reconcile silently. Renaming a column here renames nothing; it
means amending the manuscript.

## Legend

The manuscript gives nine columns per entity. The first, *My Care Entities*,
carries the entity name on the first row and is blank thereafter; it is folded
into the section heading here. The remaining eight are reproduced as-is:

| Column | Meaning |
|---|---|
| Attribute Name | Column name as written in the manuscript |
| Contents | Plain-language description of what the column holds |
| Type | SQL type |
| Format | Value shape — `9999` / `255` for integers, `XXXX` for strings, `T/F` for booleans, an explicit date mask for temporals |
| Range | Declared length. `—` where the manuscript gives none (TEXT and JSON columns) |
| Required | `Yes` = NOT NULL, `No` = nullable |
| PK or FK | Key role, blank for ordinary columns |
| FK Reference Table | Referenced entity, blank unless the column is an FK |

Values are reproduced exactly, including the manuscript's own inconsistencies.
Those are catalogued in [Transcription notes](#transcription-notes) rather than
quietly corrected.

---

## Table 5 — `BARANGAY`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | Barangay ID Number | INT | 9999 | 10 | Yes | PK | |
| name | Barangay Name | VARCHAR | XXXX | 100 | Yes | | |
| city | City / Municipality | VARCHAR | XXXX | 100 | Yes | | |
| region | Region | VARCHAR | XXXX | 100 | Yes | | |

## Table 6 — `SYMPTOM_CODE`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | Symptom Code ID Number | INT | 9999 | 10 | Yes | PK | |
| code | Canonical Symptom Code | VARCHAR | XXXX | 50 | Yes | | |
| display_name | Display Label | VARCHAR | XXXX | 100 | Yes | | |
| needs_clarification | Requires Follow-up | BOOLEAN | T/F | 1 | Yes | | |

## Table 7 — `RULESET_VERSION`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | Rule Set Version ID Number | INT | 9999 | 10 | Yes | PK | |
| label | Version Tag | VARCHAR | XXXX | 20 | Yes | | |
| status | Lifecycle State | VARCHAR | XXXX | 15 | Yes | | |
| published_at | Date Published | DATETIME | YYYY-MM-DD HH:MM:SS | 19 | No | | |
| published_by_id | Publishing Account | INT | 9999 | 10 | No | FK | USER |

## Table 8 — `LEXICON_TERM`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | Lexicon Term ID Number | INT | 255 | 10 | Yes | PK | |
| ruleset_version_id | Rule Set Version | INT | 255 | 10 | Yes | FK | RULESET_VERSION |
| symptom_code_id | Symptom Mapped To | INT | 255 | 10 | Yes | FK | SYMPTOM_CODE |
| language | Language Code | VARCHAR | XXXX | 5 | Yes | | |
| term | Surface Form | VARCHAR | XXXX | 100 | Yes | | |
| is_negation | Negation Cue | BOOLEAN | T/F | 1 | Yes | | |

## Table 9 — `TRIAGE_RULE`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | Triage Rule ID Number | INT | 255 | 10 | Yes | PK | |
| code | Rule Code | VARCHAR | XXXX | 20 | Yes | | |
| ruleset_version_id | Rule Set Version | INT | 255 | 10 | Yes | FK | RULESET_VERSION |
| name | Rule Name | VARCHAR | XXXX | 150 | Yes | | |
| expression | Rule Body | TEXT | XXXX | — | Yes | | |
| outcome_tier | Tier Asserted | VARCHAR | XXXX | 15 | Yes | | |
| priority | Conflict Order | INT | 255 | 10 | Yes | | |
| is_active | Active Status | BOOLEAN | T/F | 1 | Yes | | |

## Table 10 — `RULE_CONDITION`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | Rule Condition ID Number | INT | 9999 | 10 | Yes | PK | |
| triage_rule_id | Parent Rule | INT | 9999 | 10 | Yes | FK | TRIAGE_RULE |
| symptom_code_id | Symptom Evaluated | INT | 9999 | 10 | No | FK | SYMPTOM_CODE |
| severity_threshold_id | Threshold Tested | INT | 9999 | 10 | No | FK | SEVERITY_THRESHOLD |
| operator | Logical Connective | VARCHAR | XXXX | 10 | Yes | | |
| attribute | Qualifier Evaluated | VARCHAR | XXXX | 30 | No | | |
| comparator | Relational Operator | VARCHAR | XXXX | 5 | No | | |

> `attribute` exists **here**, on Table 10 — not on `CLARIFICATION_QUESTION`.
> That asymmetry is the whole reason ADR-0001 reuses `question_key` as the
> attribute name instead of adding a column to Table 15.

## Table 11 — `SEVERITY_THRESHOLD`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | Threshold ID Number | INT | 9999 | 10 | Yes | PK | |
| ruleset_version_id | Rule Set Version | INT | 9999 | 10 | Yes | FK | RULESET_VERSION |
| key | Threshold Key | VARCHAR | XXXX | 50 | Yes | | |
| label | Threshold Label | VARCHAR | XXXX | 100 | Yes | | |
| value | Cut-off Value | VARCHAR | XXXX | 30 | Yes | | |
| tier | Tier Escalated To | VARCHAR | XXXX | 15 | Yes | | |
| is_override | Red-flag Override | BOOLEAN | T/F | 1 | Yes | | |

## Table 12 — `DEVICE`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | Device ID Number | INT | 255 | 10 | Yes | PK | |
| barangay_id | Barangay Deployed | INT | 255 | 10 | Yes | FK | BARANGAY |
| type | Deployment Class | VARCHAR | XXXX | 30 | Yes | | |
| label | Installation Label | VARCHAR | XXXX | 50 | Yes | | |
| api_token | Enrolment Token | VARCHAR | XXXX | 80 | Yes | | |
| status | Connectivity State | VARCHAR | XXXX | 15 | Yes | | |
| is_approved | Enrolment Approved | BOOLEAN | T/F | 1 | Yes | | |
| registered_at | Date Enrolled | DATETIME | YYYY-MM-DD HH:MM:SS | 19 | Yes | | |
| last_sync_at | Last Synchronisation | DATETIME | YYYY-MM-DD HH:MM:SS | 19 | No | | |

## Table 13 — `TRIAGE_SESSION`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | Triage Session ID Number | INT | 9999 | 10 | Yes | PK | |
| client_session_uuid | Session Idempotency Key | CHAR | XXXX | 36 | Yes | | |
| barangay_id | Barangay Conducted | INT | 9999 | 10 | Yes | FK | BARANGAY |
| device_id | Device Used | INT | 9999 | 10 | No | FK | DEVICE |
| ruleset_version_id | Rule Set Applied | INT | 9999 | 10 | Yes | FK | RULESET_VERSION |
| matched_rule_id | Determining Rule | INT | 9999 | 10 | No | FK | TRIAGE_RULE |
| sync_batch_id | Upload Batch | INT | 9999 | 10 | No | FK | SYNC_BATCH |
| language | Language Used | VARCHAR | XXXX | 5 | Yes | | |
| started_at | Session Start Timestamp | TIMESTAMP | YYYY-MM-DD HH:MM:SS | | Yes | | |
| completed_at | Session Completion Timestamp | TIMESTAMP | YYYY-MM-DD HH:MM:SS | | Yes | | |
| synced_at | Aggregate Sync Timestamp | TIMESTAMP | YYYY-MM-DD HH:MM:SS | | No | | |

> **No `outcome_tier`.** The tier is derived by
> `Domain/Triage/SessionTierResolver` (red flag → matched rule → `rhu`), which
> is exact for the v1 bundle because v1 ships no severity thresholds. An
> `is_override` threshold would leave no trace here — see the Phase 4 tripwire
> in `STATUS.md`.
>
> `sync_batch_id` and `synced_at` are the columns that contradict the Data
> Dictionary's intro sentence; see [Transcription notes](#transcription-notes).

## Table 14 — `SESSION_SYMPTOM`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | Session Symptom ID Number | INT | 255 | 10 | Yes | PK | |
| triage_session_id | Parent Session | INT | 255 | 10 | Yes | FK | TRIAGE_SESSION |
| symptom_code_id | Symptom Resolved | INT | 255 | 10 | Yes | FK | SYMPTOM_CODE |
| matched_term_id | Lexicon Term Matched | INT | 255 | 10 | No | FK | LEXICON_TERM |
| negated | Negation Applied | BOOLEAN | T/F | 1 | Yes | | |

> Stores the **resolved symptom code**, never the patient's raw text. There is
> no free-text column anywhere in this entity, which is what makes "raw symptom
> text never leaves the device" enforceable at the schema level.

## Table 15 — `CLARIFICATION_QUESTION`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | Question ID Number | INT | 255 | 10 | Yes | PK | |
| ruleset_version_id | Rule Set Version | INT | 255 | 10 | Yes | FK | RULESET_VERSION |
| symptom_code_id | Triggering Symptom | INT | 255 | 10 | Yes | FK | SYMPTOM_CODE |
| question_key | Question Key | VARCHAR | XXXX | 50 | Yes | | |
| language | Language Code | VARCHAR | XXXX | 5 | Yes | | |
| prompt | Question Text | TEXT | XXXX | — | Yes | | |
| answer_type | Response Format | VARCHAR | XXXX | 15 | Yes | | |
| allowed_answers | Allowed Answers | JSON | XXXX | — | Yes | | |
| red_flag_answer | Emergency Trigger | VARCHAR | XXXX | 50 | No | | |

> **No `attribute` column, by design.** Confirmed against the source — Table 10
> has one, Table 15 does not. `evaluate()` reuses `question_key` itself as the
> attribute name, so a question keyed `fever_duration_days` feeds
> `attributes["fever_duration_days"]`. Phase 3 migrations follow the same
> convention rather than adding the column. See ADR-0001.

## Table 16 — `CLARIFICATION_ANSWER`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | Answer ID Number | INT | 9999 | 10 | Yes | PK | |
| triage_session_id | Parent Session | INT | 9999 | 10 | Yes | FK | TRIAGE_SESSION |
| clarification_question_id | Question Answered | INT | 9999 | 10 | Yes | FK | CLARIFICATION_QUESTION |
| answer | Response Given | VARCHAR | XXXX | 50 | Yes | | |
| is_red_flag | Red-flag Response | BOOLEAN | T/F | 1 | Yes | | |

## Table 17 — `USER`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | User ID Number | INT | 9999 | 10 | Yes | PK | |
| email | Login Identifier | VARCHAR | XXXX | 150 | Yes | | |
| password_hash | Password Digest | VARCHAR | XXXX | 255 | Yes | | |
| email_verified_at | Date Verified | DATETIME | YYYY-MM-DD HH:MM:SS | 19 | No | | |
| role_id | Role Held | INT | 9999 | 10 | Yes | FK | ROLE |
| barangay_id | Barangay Assigned | INT | 9999 | 10 | No | FK | BARANGAY |

> `password_hash`, not Laravel's conventional `password`. The `User` model
> overrides `getAuthPassword()` rather than renaming a manuscript column.
> `barangay_id` being nullable is what distinguishes an unscoped super-admin
> from a barangay-scoped sub-admin (UT-016, UT-019).
>
> There is **no token table** in the dictionary — no `personal_access_tokens`,
> no `remember_token`. Phase 4 has to choose stateless JWT (no table, no
> amendment) or Sanctum (one new table, amendment required).

## Table 18 — `REPORT`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | Report ID Number | INT | 9999 | 10 | Yes | PK | |
| type | Export Class | VARCHAR | XXXX | 30 | Yes | | |
| barangay_id | Barangay Covered | INT | 9999 | 10 | No | FK | BARANGAY |
| start_date | Reporting Start | DATE | YYYY-MM-DD | 10 | Yes | | |
| end_date | Reporting End | DATE | YYYY-MM-DD | 10 | Yes | | |
| format | Output Format | VARCHAR | XXXX | 10 | Yes | | |
| file_size_kb | File Size | INT | 9999 | 10 | Yes | | |
| generated_by_id | Requesting Account | INT | 9999 | 10 | Yes | FK | USER |
| generated_at | Date Generated | DATETIME | YYYY-MM-DD HH:MM:SS | 19 | Yes | | |

## Table 19 — `AUDIT_LOG`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | Audit Log ID Number | INT | 9999 | 10 | Yes | PK | |
| actor_id | Responsible Account | INT | 9999 | 10 | No | FK | USER |
| actor_label | Actor Description | VARCHAR | XXXX | 50 | Yes | | |
| action_type | Action Class | VARCHAR | XXXX | 20 | Yes | | |
| target_table | Table Affected | VARCHAR | XXXX | 64 | Yes | | |
| target_id | Row Affected | INT | 9999 | 10 | No | | |
| old_value | State Before | JSON | XXXX | — | No | | |

> ⚠️ **Amendment approved 2026-09-04, not yet applied to the `.docx`.** One row
> is owed at the end of this table:
>
> ```
> | created_at | Date Recorded | DATETIME | YYYY-MM-DD HH:MM:SS | 19 | Yes |  |
> ```
>
> The code already implements it — `audit_logs.created_at` exists and is the
> only timestamp column in the entire database. The justification is that
> Figure 41's own text already promises each entry is "stamped with the
> responsible actor and timestamp", so the Data Dictionary contradicted the
> manuscript body. No ERD change is needed: it adds a non-key column and alters
> no relationship in Figure 42.
>
> `new_value` was considered and **deliberately rejected** — the version-scoped
> ruleset tables already serve Figure 41's reconstruction claim, so `old_value`
> suffices.
>
> **Until the `.docx` is edited, this transcription shows Table 19 as the
> manuscript still has it.** Remove this note when the edit lands.

## Table 20 — `FACILITY`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | Facility ID Number | INT | 255 | 10 | Yes | PK | |
| barangay_id | Barangay Served | INT | 255 | 10 | No | FK | BARANGAY |
| name | Facility Name | VARCHAR | XXXX | 150 | Yes | | |
| type | Facility Class | VARCHAR | XXXX | 30 | Yes | | |
| address | Facility Address | VARCHAR | XXXX | 255 | No | | |
| contact_number | Contact Number | VARCHAR | XXXX | 30 | No | | |
| operating_hours | Service Hours | VARCHAR | XXXX | 100 | No | | |
| is_active | Active Status | BOOLEAN | T/F | 1 | Yes | | |

> **Orphaned.** No module or use case reads this entity. Either wire it to the
> emergency "Call for help" action or drop it — deferred to Phase 5.

## Table 21 — `HEALTH_TIP`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | Health Tip ID Number | INT | 9999 | 10 | Yes | PK | |
| ruleset_version_id | Rule Set Version | INT | 9999 | 10 | Yes | FK | RULESET_VERSION |
| symptom_code_id | Symptom Addressed | INT | 9999 | 10 | No | FK | SYMPTOM_CODE |
| outcome_tier | Tier Accompanied | VARCHAR | XXXX | 15 | Yes | | |
| language | Language Code | VARCHAR | XXXX | 5 | Yes | | |
| title | Guidance Heading | VARCHAR | XXXX | 150 | Yes | | |
| body | Guidance Text | TEXT | XXXX | — | Yes | | |
| display_order | Presentation Sequence | INT | 9999 | 10 | Yes | | |

> `ruleset_version_id`-scoped, so health tips ship to devices with the bundle —
> but `RulesetBundle` has no `healthTips` field yet. Ruleset-contract change,
> deferred to the publish endpoint. Content here is medical guidance and needs
> clinical review before it ships.

## Table 22 — `SYNC_BATCH`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | Sync Batch ID Number | INT | 9999 | 10 | Yes | PK | |
| device_id | Originating Device | INT | 9999 | 10 | Yes | FK | DEVICE |
| client_batch_uuid | Idempotency Key | CHAR | XXXX | 36 | Yes | | |
| session_count | Sessions Carried | INT | 9999 | 10 | Yes | | |
| status | Attempt Outcome | VARCHAR | XXXX | 15 | Yes | | |
| attempt_count | Delivery Attempts | INT | 9999 | 10 | Yes | | |
| error_code | Failure Reason | VARCHAR | XXXX | 50 | No | | |
| started_at | Upload Commenced | DATETIME | YYYY-MM-DD HH:MM:SS | 19 | Yes | | |
| completed_at | Upload Concluded | DATETIME | YYYY-MM-DD HH:MM:SS | 19 | No | | |

> `client_batch_uuid` carries a UNIQUE index in the schema. It is the column
> the sync endpoint's idempotency rests on: a duplicate POST returns `200` with
> the original result, never `409` (UT-015). Note that Table 13 has its own
> separate `client_session_uuid` — two distinct idempotency keys, batch-level
> and session-level.

## Table 23 — `AGGREGATE_STAT`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | Aggregate Stat ID Number | INT | 9999 | 10 | Yes | PK | |
| barangay_id | Barangay Summarised | INT | 9999 | 10 | Yes | FK | BARANGAY |
| symptom_code_id | Symptom Counted | INT | 9999 | 10 | No | FK | SYMPTOM_CODE |
| period_start | Interval Start | DATE | YYYY-MM-DD | 10 | Yes | | |
| period_end | Interval End | DATE | YYYY-MM-DD | 10 | Yes | | |
| granularity | Interval Width | VARCHAR | XXXX | 10 | Yes | | |
| outcome_tier | Tier Counted | VARCHAR | XXXX | 15 | No | | |
| language | Language Counted | VARCHAR | XXXX | 5 | No | | |
| session_count | Number of Sessions | INT | 9999 | 10 | Yes | | |
| computed_at | Date Refreshed | DATETIME | YYYY-MM-DD HH:MM:SS | 19 | Yes | | |

> `session_count` is stored raw. Suppression is a **read-path** concern: every
> aggregate read — dashboard, trends, map, CSV, PDF — goes through
> `Domain/Aggregation/SuppressionRule`, which renders any bucket under 5 as
> `<5` (UT-018, UT-020). Never reimplement that inline.

## Table 24 — `ROLE`

| Attribute Name | Contents | Type | Format | Range | Required | PK or FK | FK Reference Table |
|---|---|---|---|---|---|---|---|
| id | Role ID Number | INT | 9999 | 10 | Yes | PK | |
| name | Role Name | VARCHAR | XXXX | 20 | Yes | | |
| label | Display Name | VARCHAR | XXXX | 50 | Yes | | |
| description | Scope Conferred | VARCHAR | XXXX | 255 | Yes | | |

---

## Transcription notes

Things reproduced as-is above that are worth knowing about, and the few places
where a judgement call was made.

**Line-wrap artefacts were normalised.** Word wrapped several long identifiers
inside their cells, which the XML preserves as a literal space. These were
joined back up: `CLARIFICATION_ QUESTION`, `CLARIFICATION_ ANSWER`,
`ruleset_ version_id`, `symptom_code_ id`, `allowed_ answers`,
`red_flag_ answer`, `triage_ session_id`, `clarification_ question_id`. No
column actually contains a space.

**The `Format` column is inconsistent for integers, and this is preserved.**
Tables 5, 7, 10, 11, 13, 16, 17, 18, 19, 21, 22, 23 and 24 write `9999`;
Tables 8, 9, 12, 14, 15 and 20 write `255`. Both denote an integer. Nothing in
the schema depends on the distinction — it is cosmetic drift in the manuscript,
not two different types. Worth tidying in a future revision, not worth an
amendment on its own.

**Table 13 uses `TIMESTAMP` where every other entity uses `DATETIME`,** and
leaves the `Range` cell blank for all three of its temporal columns rather than
writing `19`. Reproduced as written. The schema follows it literally —
`triage_sessions` uses `timestamp()`, everything else uses `dateTime()`.

**`TRIAGE_SESSION.completed_at` is Required = Yes.** A session cannot be
persisted mid-flight; only completed sessions are stored. That is the
manuscript's call and the schema honours it.

**Table 16's name is misspelled in the List of Tables** as
`CLARIFICATIO_ANSWER` (page 86). The entity table itself is spelled correctly.
Cosmetic; worth fixing in the same pass as the Table 19 amendment.

**Page numbers in the List of Tables are slightly out of order** — Table 20
`FACILITY` is listed at page 92 and Table 21 `HEALTH_TIP` at 91, and Table 22
also claims 92. Field ordering in the document body is correct and is what was
transcribed; the page numbers are a stale auto-generated index.

**The Data Dictionary's intro sentence is wrong.** It says "only de-identified
aggregates are synchronized", but Table 13 carries `sync_batch_id` and
`synced_at`, and Table 22 carries `session_count`. De-identified **session
records** sync; aggregates are computed server-side. The Legal Bases section
and the schema both agree on this. One-sentence manuscript fix, still owed.

---

## Conformance against the implemented schema

Checked 2026-09-12 against the 20 migrations in
`apps/api/database/migrations/`, which were themselves verified by execution
against MySQL 8 (`migrate:fresh`, Pest 35 passed / 124 assertions).

**Every one of the 20 entities matches column-for-column, in name,
nullability, and declared length.** There is exactly one divergence, and it is
the approved amendment:

| Divergence | Status |
|---|---|
| `audit_logs.created_at` exists in the schema, not yet in Table 19 | Approved 2026-09-04. `.docx` edit still owed. |

Three conventions apply everywhere and are not drift:

- **Table names are Laravel-plural** (`barangays`, `triage_sessions`). The
  dictionary names *entities*, not tables. Columns map one-to-one.
- **`increments()` / `unsignedInteger()`, never `id()`.** The dictionary says
  `INT`; Laravel's `id()` would emit `BIGINT`. Verified in the live schema —
  keys are `int unsigned`.
- **No `timestamps()` anywhere.** Every model sets `$timestamps = false`. The
  dictionary declares its own temporal columns and no others;
  `audit_logs.created_at` is the only timestamp column in the database.

Indexes and foreign-key delete behaviour are implementation additions the
dictionary does not describe; each is justified in a comment at its migration.

| Entity | Table | Implemented as |
|---|---|---|
| BARANGAY | 5 | `barangays` |
| SYMPTOM_CODE | 6 | `symptom_codes` |
| RULESET_VERSION | 7 | `ruleset_versions` |
| LEXICON_TERM | 8 | `lexicon_terms` |
| TRIAGE_RULE | 9 | `triage_rules` |
| RULE_CONDITION | 10 | `rule_conditions` |
| SEVERITY_THRESHOLD | 11 | `severity_thresholds` |
| DEVICE | 12 | `devices` |
| TRIAGE_SESSION | 13 | `triage_sessions` |
| SESSION_SYMPTOM | 14 | `session_symptoms` |
| CLARIFICATION_QUESTION | 15 | `clarification_questions` |
| CLARIFICATION_ANSWER | 16 | `clarification_answers` |
| USER | 17 | `users` |
| REPORT | 18 | `reports` |
| AUDIT_LOG | 19 | `audit_logs` |
| FACILITY | 20 | `facilities` |
| HEALTH_TIP | 21 | `health_tips` |
| SYNC_BATCH | 22 | `sync_batches` |
| AGGREGATE_STAT | 23 | `aggregate_stats` |
| ROLE | 24 | `roles` |

## Re-extracting this from the manuscript

The transcription was produced by reading `word/document.xml` out of the
`.docx` with Python's stdlib — no `python-docx` install needed. The Data
Dictionary occupies document tables 7 through 26, in Table 5 → Table 24 order.

```python
import zipfile, xml.etree.ElementTree as ET
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
root = ET.fromstring(zipfile.ZipFile(DOCX).read('word/document.xml'))
tables = [t for t in root.find(W + 'body') if t.tag == W + 'tbl']
for tbl in tables[6:26]:                      # 0-indexed: document tables 7..26
    for tr in tbl.findall(W + 'tr'):
        cells = [' '.join(''.join(t.text or '' for t in p.iter(W + 't')).strip()
                          for p in tc.findall(W + 'p')).strip()
                 for tc in tr.findall(W + 'tc')]
        print(' | '.join(cells))
```

Run it with `PYTHONIOENCODING=utf-8` — the manuscript contains characters
(`Ⅰ`, `—`) that Windows' default cp1252 console encoding cannot emit.
