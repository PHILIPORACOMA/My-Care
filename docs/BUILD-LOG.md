# Build log — Phases 4 to 9

This is the running record of the build that finishes My Care after Phase 3.
It is written for Philipo: what was built, in what order, what was decided, and
what still needs a human. Each milestone below is appended when it lands, with
its verification result and commit.

`docs/STATUS.md` stays the short checkpoint. This file is the long form.

---

## Ground rules for this build

- **No manuscript amendments.** Where the Data Dictionary or a figure cannot
  support something, the workaround is done in code and written down here and
  in an ADR. Nothing below adds, renames or removes a column or table.
- **No invented clinical content.** No lexicon terms, triage rules,
  clarification questions or health tips are written by the build. The tools to
  author them are built; the content comes from the team and the clinical
  appraisal. Tests use only fixtures or the manuscript's own examples
  (`sipon` / `sip-on`, `walay hilanat` from Table 31).
- **Verification is by execution.** Every milestone records the test result it
  was committed with.

## Decisions taken before the build (2026-09-17)

| Question | Decision | Why |
|---|---|---|
| How does a patient phone get a `DEVICE` row and token? | **Self-registers anonymously, auto-approved**, rate-limited, revocable by a super-admin | Patient phones actually sync; revocation handles abuse |
| How is the tier of an override-threshold session recovered without `outcome_tier`? | **Replay the real triage engine (Node) on the server** during aggregation | One engine implementation, exact result — the Figure 41 reconstruction claim made literal |
| Who writes the Tagalog / Cebuano UI text? | **Drafted in the build, every string flagged for native + clinical review** | App usable in all three languages now; nothing ships unreviewed by accident |
| Figure 22's microphone | **Left out, documented** | No offline Tagalog/Cebuano recognizer fits the device limits (details below) |

### Why there is no microphone button

Checked 2026-09-17:

- Chrome's on-device speech recognition (`processLocally`) supports no Filipino
  or Cebuano, and needs Chrome 139+ against the manuscript's Chrome 80 minimum.
  Chrome's default speech recognition sends audio to Google, which breaks
  offline use and non-negotiable #8 (raw symptom input never leaves the device).
- Vosk (open source, runs offline in the browser) has a Tagalog model of
  320 MB — over Table 27's 100 MB storage — and no Cebuano model.
- Transformer models (Whisper-class) are excluded by the 2 GB RAM constraint.

The one design that fits is **symptom-only keyword spotting**: a small
non-transformer model that recognises only lexicon terms and feeds the same
matcher as typed text. It needs recorded voice samples per term from Tagalog and
Cebuano speakers (personal data, needs consent) and retraining per lexicon
version. Recorded as future work. The symptom chips, which Figure 22 itself says
lower the literacy barrier, are built.

## Plan

| # | Milestone | Phase |
|---|---|---|
| 0 | Last staff-auth 500 (no `Accept: application/json`) | 3 |
| 1 | Device self-registration, hashed device tokens, public barangay list, facilities | 4/6 |
| 2 | Ruleset lifecycle: authoring, versioning, review, publish, rollback, v1 importer | 4 |
| 3 | Sub-admin account management | 4 |
| 4 | Engine replay, aggregation, dashboard/trends/sync/map/report/audit endpoints | 7 |
| 5 | Shared packages: lexicon matcher (NLP), API client, UI kit | 4/5/7 |
| 6 | Super-admin console (Figures 36–41) | 4 |
| 7 | Sub-admin portal (Figures 30–35) | 7 |
| 8 | Patient PWA (Figures 17–29) and its offline sync layer | 5/6 |
| 9 | Integration and offline end-to-end tests, CI | 8 |
| 10 | Deployment configuration and guide | 9 |

---

## Milestones

### 0 — Last staff-auth 500

**Done.** `bootstrap/app.php` calls `redirectGuestsTo(null)`; an unauthenticated
staff request answers a JSON 401 whatever it accepts. Tests for no header,
`*/*` and `text/html` were red (500) first. Pest 98 passed / 335 assertions.
Commits `5aa26c7`, `7cd72ae` on `feat/UT-020-laravel-api-schema` (PR #1).

### 1 — Devices, tokens, barangays, facilities

**Done.** Pest 115 passed / 397 assertions. Full reasoning in
`docs/adr/0005-device-enrolment-and-facilities.md`.

What exists now:

- `POST /api/v1/devices` — a phone registers itself with only a barangay and a
  device type, is approved immediately, and receives its token once.
  Rate-limited to 10 an hour per IP.
- Device tokens are stored as a lookup prefix plus a SHA-256 digest inside the
  same `VARCHAR(80)` column. The old plaintext comparison is gone.
- `GET /api/v1/barangays` — public list for onboarding. `BarangaySeeder` (now in
  `migrate --seed`) adds Carcar City's 15 barangays from PhilAtlas.
- `GET /api/v1/facilities` — for the emergency "Call for help" button. Facility
  data comes from a CSV: `php artisan mycare:facilities:import facilities.csv`.
  This wires the previously orphaned `FACILITY` table.
- Devices report how many sessions they still hold offline in an
  `X-Pending-Sessions` header, for the sync screens.

**Needs a human:**

- The facility CSV (names, emergency numbers, hours) from the City Health
  Office.
- Confirm the 15 barangay names against the City Health Office's own list.
- Accept, for the defence, that self-registration means surveillance figures
  are indicative: anyone can register a device. Revocation exists.

### 2 — Ruleset lifecycle (Figure 39, UT-007–UT-011)

**Done.** Pest 136 passed / 512 assertions. Full reasoning in
`docs/adr/0006-ruleset-lifecycle.md`.

What exists now (all under `/api/v1/console/`, super-admin only):

- Draft → review → publish, with rollback. Every save writes a **new version**
  (UT-010); nothing is edited in place or deleted. Exactly one version is
  published at a time.
- Publishing requires ticking "clinical review took place". The software cannot
  verify a clinician; it records who attested.
- Rule expressions (`IF a AND NOT b THEN rhu`) are generated from the
  conditions, so the explanation can never disagree with the logic.
- Content validation catches the mistakes that would give a *wrong tier*
  silently: unknown codes, half-built conditions, non-numeric thresholds,
  red-flag answers that are not allowed answers, and language variants of a
  question that disagree on where the red-flag answer is.
- Symptom codes lock once a reviewed or published version uses them.
- **v1 import:** `npm run export:v1 -w @mycare/ruleset`, then
  `php artisan mycare:ruleset:import ../../packages/ruleset/dist/v1.json`.
  Verified with the real file: 23 rules, 9 emergency. It lands as a **draft**.

Schema gap closed without an amendment: **condition order.** Because conditions
are only ever inserted in the author's order into a version that never changes,
the primary key is the sequence.

**Needs a human:**

- Clinical review of v1 before anyone publishes it.
- Lexicon terms, clarification questions and health tips — the console can hold
  them; the content has to come from the team.

### 3 — Account and device management (Figure 38, UT-019)

**Done.** Pest 148 passed / 559 assertions.

What exists now (`/api/v1/console/`, super-admin only):

- Create a sub-admin with an email, a password (12+ characters, letters and
  numbers) and one barangay. Signing in as that account returns the barangay
  scope — asserted end to end.
- Deactivate, reactivate (by setting a new password), reset a password, move a
  sub-admin to another barangay. A super-admin cannot deactivate themselves.
- List devices, revoke and reinstate them (audited).
- `php artisan mycare:staff:create-super-admin <email>` creates the first
  development-team account on a fresh server. The password is prompted, never
  typed on the command line.

How Figure 38's columns work **without** new columns:

- **Status** — `USER` has no status column. Deactivating replaces the password
  digest with a locked, bcrypt-shaped value no password can match (the old Unix
  account-locking trick). Sanctum's session check sees the digest change and
  ends the person's existing sessions on their next request. A test proves the
  session really ends, and was checked by removing the deactivation and watching
  it fail.
- **Creation date** — read from the audit log's `created` entry for the account.
- **"Sub-admin · RHU" vs "Sub-admin · LGU"** — **not implemented.** `ROLE` has a
  single `sub_admin` role (Figure 38's own caption says RHU and LGU share it) and
  `USER` has nowhere to store which one a person belongs to. The console shows
  "Sub-admin". This is the one Figure 38 detail the schema cannot express.

### 4 — Engine replay, aggregation, surveillance endpoints (UT-014, 016, 017, 018, 020)

**Done.** Pest 174 passed / 708 assertions; `@mycare/engine-replay` 5/5. Full
reasoning in `docs/adr/0007-replay-aggregation-and-surveillance.md`.

**The Phase 4 tripwire is closed without an amendment.** `TRIAGE_SESSION` has no
tier column, and the old `SessionTierResolver` read a session escalated by an
override threshold as `rhu`. Now the server replays each stored session through
the *same* triage engine the phone ran, against the exact ruleset version it
used. Because the engine is deterministic and published versions never change,
the replayed tier is the tier the patient saw. A test covers exactly the case the
old resolver got wrong. The old resolver is deleted.

What exists now:

- `php artisan mycare:aggregate` — scheduled every 10 minutes; rebuilds the last
  60 days of `AGGREGATE_STAT`. Idempotent. Days are Manila days.
- Portal endpoints (`/api/v1/staff/…`, sub-admin and super-admin): `dashboard`,
  `trends` (14-day chart, cluster banner, watch list), `sync-status`, `map`,
  `barangays`, `reports` (CSV/PDF generate, list, download).
- Console endpoints: `system-health` (Figures 37/40), `audit-logs` (Figure 41,
  read-only, filter by category), audit export as a de-identified report.
- **Privacy on every read path:** counts under 5 come out as
  `{display: "<5", value: null}` — the raw number is never in the response.
  When one part of a shown total is masked, a second part is masked too so
  nobody can subtract. Sub-admins only ever see their own barangay.

**Needs a human:**

- **Server needs Node 20** and `npm run build -w @mycare/engine-replay` for
  dashboards to refresh (deployment guide covers it).
- Review the cluster-detection thresholds (`config/mycare.php`) with the City
  Health Office's surveillance officer.

**Deviations from the figures (no column exists):** Figure 37's "report worker"
is replaced by the aggregation job and engine replay in the service panel
(there is no queue worker); audit categories are derived, not stored.

### 5 — Shared frontend packages (UT-002, UT-003, UT-004)

**Done.** lexicon-matcher 11/11, api-client 5/5, ui 9/9; typecheck and purity
clean; engine still 12/12.

- **`packages/lexicon-matcher`** — the on-device NLP layer. Pure and
  dependency-free like the engine, and checked by the same purity script (now
  shared at `scripts/check-purity.mjs`). It normalises text (case, accents,
  hyphens: `sip-on` → `sipon`), tolerates typos on words of five letters or
  more (never on short words, so `ubo` can never become `ulo`), handles split
  and run-together words, and treats **negation as lexicon content** — a term
  flagged `isNegation` like the manuscript's `walay hilanat`. It contains **no
  Cebuano or Tagalog vocabulary of its own**; every word comes from the
  published lexicon. If a symptom is mentioned both negated and plainly it is
  reported present, erring toward escalation. It proposes symptom codes only —
  it never assigns a tier. UT-003 and UT-004 are tested with the manuscript's
  own examples mapped to fixture codes.
- **`packages/api-client`** — typed client for the staff and console API.
  Cookie-based Sanctum: no token ever lives in JavaScript. Handles the CSRF
  cookie, retries once on an expired token (419), surfaces field errors.
- **`packages/ui`** — tokens and components for the portal (light, teal) and
  console (dark), following the storyboards. A `<Count>` component renders a
  suppressed cell as `<5` with an explanation; the chart draws a masked day as a
  fixed hatched block, never a bar sized to a hidden count.

**Dependencies:** the first set of frontend tools came back from `npm audit`
with a critical and a high advisory (old Vitest and Vite). They were replaced
with the current patched releases that still run on Node 20 — Vite 8,
Vitest 4, React Router 7, React 18.3.1 (the manuscript's pinned version).
`npm audit`: **0 vulnerabilities.**

### 6 — Super-admin console (Figures 36–41) — IN PROGRESS, stopped here

**Written, not verified, not committed.** Session ended 2026-09-17 at Philipo's
request before anything in `apps/console` was run. Expect type errors and
failing tests on the first run; fix them before committing.

What is written (`apps/console`, React 18 + Vite, dark theme, port 5175,
`/api` and `/sanctum` proxied to `php artisan serve` so the session cookie is
same-origin):

- `LoginPage` (Figure 36) — sign in; a signed-in sub-admin sees an explanation
  instead of the console.
- `SystemDashboardPage` (Figure 37) — barangays live, sync health, active
  sub-admins, published version, service health, activity.
- `UsersPage` (Figure 38) — list, add sub-admin, reset password / reactivate,
  change barangay, deactivate.
- `rules/RulesetListPage`, `rules/RulesetVersionPage` (Figure 39) — versions
  with status; tabbed editor for rules (with condition reordering and a live
  expression preview), thresholds and red-flag overrides, clarification
  questions, lexicon, health tips; save-as-new-version, submit for review,
  return to draft, publish (with the clinical-review attestation dialog), new
  draft from any version, rollback; bundle JSON import.
- `rules/TestPanel` — "Test & explain": runs the real `matchSymptoms()` and
  `evaluate()` on unsaved content in the browser and says which rule fired and
  why.
- `rules/SymptomCodesPage` — add/edit codes; locked codes cannot be edited.
- `SyncHealthPage` (Figure 40) — service status, per-barangay last report,
  device list with revoke/reinstate.
- `AuditLogPage` (Figure 41) — filter by category, pagination, de-identified
  CSV/PDF export.
- `rules/rules.test.tsx` — expression preview matches the server's formatter,
  reordering updates the expression, read-only mode, TestPanel runs the engine.

To resume:

```bash
npm install
npm run typecheck -w @mycare/console
npm test -w @mycare/console
cd apps/api && php artisan serve      # in one terminal
npm run dev -w @mycare/console        # in another, then open http://localhost:5175
```

`SANCTUM_STATEFUL_DOMAINS` in `apps/api/.env` must include `localhost:5175`
(the example file lists 5173 only) — add it before signing in.

---

## Where the build stopped (2026-09-17)

| # | Milestone | State |
|---|---|---|
| 0 | Staff-auth 500s | ✅ committed (PR #1 branch, not pushed) |
| 1 | Devices, tokens, barangays, facilities | ✅ `18acb14` |
| 2 | Ruleset lifecycle | ✅ `a644d52` |
| 3 | Accounts and devices | ✅ `14ecd28` |
| 4 | Replay, aggregation, surveillance API | ✅ `2739b64` |
| 5 | Lexicon matcher, API client, UI kit | ✅ `65fd93b` |
| 6 | Super-admin console | 🔨 written, unverified, uncommitted |
| 7 | Portal | ⬜ |
| 8 | Patient PWA + offline sync | ⬜ |
| 9 | E2E + CI | ⬜ |
| 10 | Deployment | ⬜ |

Nothing on `feat/UT-011-phases-4-to-9` has been pushed.

---

## Milestone 6 verified (2026-09-18)

`apps/console` typechecks clean, passes 4/4 tests, builds for production
(242 kB, 76 kB gzipped), and was signed into over HTTP through the Vite proxy as
`super@mycare.test`. Every console and staff endpoint answered 200: system
health, ruleset versions, symptom codes, users, devices, audit log, dashboard,
trends, sync status, map, reports.

**One real bug, found only by running it.** `GET /console/system-health`
returned **500**. Checking whether Node is available goes through Symfony's
Process, which buffers output through temporary files; under `php artisan serve`
on Windows the child server process inherits no writable TMP, so the check died
and took the whole health screen with it. A health screen that dies tells an
operator nothing.

Fixed: `EngineReplayer::availability()` never throws. It returns a status and a
plain-language reason ("The PHP process has no writable temporary directory..."),
which the screen shows as *down* with that detail. The replay path itself still
fails loudly during aggregation, because counting sessions it could not replay
would be worse than a stale dashboard. Two regression tests cover a missing
script and a missing Node binary. Suite: **Pest 176 / 716**.

**Local run command.** Use
`php -d variables_order=EGPCS artisan serve --no-reload` for the API. Plain
`artisan serve` forwards only an allow-list of environment variables, and PHP's
default `variables_order` leaves `$_ENV` empty, so TMP and TEMP never reach the
server process and engine replay cannot start. With those flags System Health
reports "Node v20.20.2". Linux deployment under php-fpm is unaffected.

Still worth doing once by hand: click through Figures 36-41 in a browser.

---

### 7 — Sub-admin portal (Figures 30-35)

**Done and verified 2026-09-18.** Typecheck clean, 4/4 tests, production build
(207 kB, 68 kB gzipped), and a live sign-in as the sub-admin through the
portal's own proxy.

What exists (`apps/portal`, React 18 + Vite, light theme, port 5174, served
under `/portal/` as Figure 30 shows):

- **Login** (Figure 30) - "Health worker portal", with the figure's own line:
  accounts are created by the system administrator.
- **Dashboard** (Figure 31) - three tier cards and the total for a date range,
  plus the most common symptoms as a ranked list. Symptoms under five sessions
  are left out of the ranking entirely: ordering them would reveal their
  relative sizes.
- **Trends & surveillance** (Figure 32, UT-017) - the cluster banner in plain
  words ("a 38% week-over-week rise in rhu referrals this week"), the 14-day
  volume chart with this week shaded when a cluster is flagged, and the watch
  list with rising / stable / low.
- **Sync & status** (Figure 33, UT-014) - a banner saying whether the data is
  current, device coverage per barangay, the queue still sitting on devices,
  and sessions received. The screen's job is to make a stale figure read as "a
  barangay is out of signal", not "the system is broken".
- **Data & reports** (Figure 34, UT-018) - pick a report, range and format,
  generate and download; recent reports listed for re-download.
- **Aggregate map** (Figure 35) - barangay tiles shaded by relative volume.
  Deliberately tiles, not a drawn map: the manuscript has no barangay
  boundaries and inventing coordinates would put made-up geography into a
  health system. Area level only, never GPS - the figure's own guarantee.

Every screen carries a plain-language privacy note explaining what "<5" means
and why a percentage or a ranking is sometimes missing.

**Live verification** (sub-admin `sub@mycare.test` through the portal proxy):
every staff endpoint 200; the barangay list returned **only Valladolid**; the
console refused the same session with **403**; and a CSV report generated and
downloaded came back scoped to Valladolid with every count suppressed:

```
Barangay,"Home management","RHU referral","Emergency referral","Total sessions"
Valladolid,<5,<5,<5,<5
```

That is UT-016 and UT-018 demonstrated end to end, not just unit-tested.

One shared-package change: `Banner` in `@mycare/ui` accepts a `className`, for
the cluster banner's accent border.

**Run it:**

```bash
npm run dev -w @mycare/portal     # http://localhost:5174/portal/
```

Sign in as `sub@mycare.test` / `password` to see the barangay-scoped view, or
as the super-admin to see every barangay with a barangay chooser.

---

### 8a - Design import: tokens and the staff apps (2026-09-18)

Imported the team's design canvas ("UI regeneration from storyboards",
Figures 17-41) through the Claude Design MCP and applied it to the built
apps. Typecheck clean; ui 9/9, portal 5/5, console 4/4; both apps build.

**Tokens now come from the design**, not from my approximations:

| | Value |
|---|---|
| Type | Poppins 400/500/600/700, IBM Plex Mono for figures and ids |
| Ground / surface | `#FBFAF7` / white, inputs `#FAF8F4` |
| Ink | `#16201E`, muted `#8A9491` |
| Accent | teal `#0D7C6C`, hover `#0A6A5B`, soft `#EAF4F1` |
| Tiers | home `#1F7A3C`, RHU `#EF7D12`, emergency `#D72B21` |
| Shape | 13px cards, 12px inputs, 99px pills |

**The console is not a dark theme.** The design gives it a dark *sidebar*
(`#221F1C`) beside a light content area, and a white login card on a dark
ground. Mine was dark throughout, so `AppShell` gained `sidebar="dark"` and the
console's `data-theme="dark"` is gone.

Design affordances added:

- **"Show" password toggle** on both logins (`PasswordField`), which neither
  screen had.
- **Segmented range switch** and the **"as of last sync" pill** on the
  dashboard.
- **Stat cards with a change line** ("▲ 12% vs previous period"). The API has
  no deltas, so the dashboard fetches the previous period too and computes it
  client-side — and only states a change **when both periods are displayable**,
  since a percentage against a suppressed figure would let a reader solve for
  the hidden count. A test covers that.
- **Ranked bars** for top symptom codes, with no bar for a suppressed count.
- The shared `CareMark` logo and the login brand block.

Fonts load from Google Fonts for the staff apps, which are online-only. **The
patient PWA will self-host a subset instead** — it must work offline inside a
100 MB budget.

Deliberately not copied from the design: Figure 37's "Report worker · queue 12"
panel. There is no queue worker in this deployment (reports generate in the
request), so the service panel keeps showing the aggregation job and engine
replay, which do exist.

Not yet done: nobody has looked at either app in a browser since the restyle.
Rendering gets verified with Playwright in Milestone 9.

---

### 8b - The patient PWA and the device half of sync (2026-09-18)

`apps/pwa`, Figures 17-29. This is the app the manuscript is actually about:
everything above it exists so that a patient in a barangay with no signal can
open a phone and get a tier. **Typecheck clean; 24/24 tests; production build
59 kB gzipped of JavaScript, 225 KiB precached.**

**What it does not have, on purpose:** no account, no login, no name, no age,
no GPS, no analytics, no microphone. The only thing the patient chooses about
themselves is a barangay and a language.

#### The screens

| Figure | Screen | Notes |
|---|---|---|
| 17 | Splash | One button. `CareMark` logo, tagline, no sign-in |
| 18 | Language | First, so every screen after it is in the chosen language |
| 19 | Adult confirmation | 18+ only (manuscript scope). Declining does not advance; it explains why in a banner rather than erroring |
| 20 | Barangay | A cached list, never GPS |
| 21 | Home | Greets the barangay, not a person. Check symptoms, health tips, settings |
| 22 | Symptom input | Free text **and** chips, both producing the same structured codes |
| 23 | Clarification | Only for codes whose symptom is flagged `needsClarification` |
| 24 | Processing | A deliberate 1.1 s pause; the engine answers in microseconds, but the "On-device analysis" badge is the screen's real job |
| 25/26/27 | Results | home (green), rhu (amber), emergency (red) |
| 28 | Health tips | Filtered by the tier just given, in the patient's language |
| 29 | Settings | Language, offline and queue state, about, "start over" (which clears prefs and queue). Barangay is set once during onboarding and only changes via "start over" |

#### The four decisions worth recording

**1. The tier is computed on the device, from a cached bundle.** `runTriage()`
calls `matchSymptoms()` from `packages/lexicon-matcher`, then `evaluate()` from
`packages/triage-engine`, with no network in between. The server is only ever
asked for the ruleset and told the result. This is what makes offline work, and
it is also the privacy argument: the words never need to leave.

**2. The answer that is sent is the canonical one, not the label tapped.** A
clarification question exists once per language in the bundle, and `evaluate()`
resolves it by `question_key` alone, taking the first variant in bundle order.
So if a patient answers "grabe" in Cebuano and the engine is comparing against
the English variant's `red_flag_answer` of "severe", a real emergency reads as
routine. `canonicalAnswer(bundle, key, index)` maps the position the patient
tapped onto the first variant's answer at that position. There is a test named
for exactly this, because the failure mode is silent and clinical.

**3. A retry reuses its batch uuid.** A phone cannot tell "my upload was lost"
from "my acknowledgement was lost". If the uuid changed on retry, the server
would store the same sessions twice and the surveillance counts would drift up
with every patch of bad signal. The uuid is generated when the batch is first
attempted and kept until the server accepts it (UT-015, and the server half is
the UNIQUE index on `client_batch_uuid`).

**4. A 422 is quarantined, not retried.** A batch the server rejects as invalid
will be rejected forever; retrying it every reconnect would block the queue
behind it. It stays stored (nothing is thrown away) but stops being attempted.

#### What syncs

Only this, per session: barangay id, ruleset version label, matched rule code,
language, started/completed timestamps, the symptom codes with a `negated` flag
and the **published lexicon term** that matched, and the clarification answers
with their red-flag flag. Two tests assert the patient's own sentence is absent
from the payload — one in `triage.test.ts` on the built record, one in
`app.test.tsx` on the actual outgoing HTTP body after a full journey.

#### Language

English copy is the design's, verbatim. **Tagalog and Cebuano are my drafts and
are not reviewed** — `src/i18n.ts` opens with a review banner saying so, and
`docs/ut-matrix.md` repeats it under UT-006. They need a native speaker and a
clinician before any field use, especially the emergency screen. A test asserts
all three dictionaries have identical keys, so no screen can half-fall-back to
English mid-sentence.

The symptom vocabulary itself is **not** in the app. Lexicon terms, clarification
questions and health tips all come from the published bundle, authored in the
console (CLAUDE.md: never invent lexicon terms). Until the team enters them,
free text matches nothing and the chips are the usable path — the chips are
built from the symptom codes that live rules actually test, so they are never
empty once a ruleset is published.

#### Offline mechanics

- **IndexedDB** (`src/storage.ts`), two stores: `prefs` (language, barangay,
  device token, cached bundle) and `queue` (finished sessions). No
  `localStorage` — it is synchronous, small, and not available to a worker.
- **Service worker** via `vite-plugin-pwa`/Workbox, `registerSW({immediate:
  true})`. Precaches the shell, the engine, the matcher and the font: a second
  visit needs no network at all. Updates apply immediately rather than on next
  launch, so a handset that just reconnected is not running last month's build
  against this month's rules.
- **Poppins is self-hosted**, four weights, 31 kB total, subset to Latin. The
  staff apps use Google Fonts; the PWA cannot.
- **Device registration** happens once, in the background, on first connection.
  It is anonymous and auto-approved (ADR-0005); the token lives in IndexedDB.
- `X-Pending-Sessions` on every sync tells the server how many records are still
  waiting, which is what Figures 33 and 40 display.

#### Build budget

Table 27 allows a 2 GB / Snapdragon 400 / Chrome 80 handset with 100 MB free.
Vite targets `chrome80, safari13`; React 18 and the two workspace packages are
the whole dependency tree at runtime. 225 KiB precached against a 100 MB budget
leaves the storage for the queue and the bundle, which is where it should go.

#### Verified

```
npm run typecheck -w @mycare/pwa     # clean
npm test -w @mycare/pwa              # 24 passed (triage 13, sync 8, journey 3)
npm run build -w @mycare/pwa         # 225 KiB precache, 59 kB gzip JS
```

The three journey tests drive the real UI with `userEvent`, real IndexedDB
(`fake-indexeddb`), the real matcher and the real engine, stubbing only
`fetch`: a full Cebuano walk-through from splash to a queued record, a red-flag
answer escalating to emergency with the 911 fallback, and a triage completed
with `fetch` throwing on every call, ending with the record waiting in the
queue.

**Not verified:** the app has not been opened in a real browser, and it has not
run against a live API yet — MySQL was stopped when the dev server came up, so
`/api/v1/barangays` returned a 500 from the proxy. Both belong to Milestone 9.

---

### 8c - One branch again (2026-09-20)

Phases 4-9 were built on `feat/UT-011-phases-4-to-9`, stacked on the PR #1
branch so that PR #1 could stay a reviewable Phase 3 on its own. That was my
call at the start of the phase work and I should have asked first, since it is
a decision about how Philipo's PRs get reviewed, not a technical one. Nobody
ever reviewed PR #1 separately, so the split bought nothing.

`feat/UT-020-laravel-api-schema` was fast-forwarded to the same commit on
2026-09-19, and the duplicate branch was deleted on 2026-09-20 - the remote
copy had already been deleted by someone else on GitHub by then. **One branch
now: `feat/UT-020-laravel-api-schema`, `1b51e0a`, 37 commits ahead of `main`.**
Every commit survives on it. The name no longer describes the contents; the
branch carries Phases 3 through 8.

**PR #1 cannot run CI while it conflicts with `main`.** GitHub builds a trial
merge for `pull_request` workflows; a conflicting PR has none, so no run is
queued and Phases 4-8 have never been through CI. The conflict is PR #2's
`apps/pwa` against ours - 8 files - and resolving it unblocks the merge and CI
together. Philipo is settling which patient app survives with the team first.

When it does merge, use **"Create a merge commit"**. Squashing would collapse
37 commits into one and lose the per-commit UT ids that
`docs/ut-matrix.md` traceability depends on; rebasing would rewrite every hash,
and STATUS.md and this log cite commits by hash.

---

### 8d - The PWA against a live API (2026-09-20)

MySQL was up, so the patient app finally ran against a real server instead of a
stubbed `fetch`. **Not a browser** - the Chrome extension is not connected here
- but everything below the rendering layer was real: `api.ts`, `sync.ts`,
`triage.ts` and `storage.ts` as shipped, the real lexicon matcher, the real
engine, a running Laravel server and MySQL. The substitutions were
`fake-indexeddb` for the browser's IndexedDB and a wrapper turning the app's
relative `/api/v1/...` paths absolute, which is what the Vite proxy does in the
browser.

What happened, in order:

| Step | Result |
|---|---|
| `GET /barangays` | 1 barangay (Valladolid) - the seeded 15 are not in this database |
| `POST /devices` | device #3 registered anonymously, token `apv6a9w8gdhr.<secret>` |
| `GET /ruleset/current` | `demo-v1`, published 2026-09-14: 2 codes, 3 lexicon terms, 2 rules, 1 question |
| Free text "naa koy hilanat" | matched `hilanat` → `fever_mild` on the device |
| Triage | **tier `rhu`, no matched rule, reason `fail_safe_default`** |
| `POST /sync/batches` | accepted; queue emptied; the row is in `triage_sessions` |
| Replay of the same session uuid | **no second row** - UT-015 holds against the live server |

The payload that went over the wire carried the symptom code and the published
lexicon term, and not one word the patient typed.

#### The one finding: `rule_conditions` is empty

`demo-v1`'s two rules have `conditions: []`. They were hand-made on
2026-09-14 during manual API testing, before the console existed, and no
`rule_conditions` rows were ever written - the table has **0 rows**.

Everything downstream follows from that, and all of it is correct behaviour:

- **No symptom chips.** `chipsFor()` offers only codes that a live rule
  actually tests. No conditions, no codes tested, no chips.
- **No rule matched**, so the engine fell to `rhu`, never `home` - ADR-0001's
  fail-safe, doing exactly its job on incomplete data.

So this is a **data** gap, not a code one. The app read a real bundle, matched
real text, and refused to guess. Fixing it needs a ruleset with conditions:
either author one in the console (draft → clinical-review attestation →
publish, ADR-0006), or `mycare:ruleset:import` the v1 export of the 23
appraisal-form presentations and publish that. **Publishing asserts clinical
review, so it is Philipo's to do, not mine.**

#### Still not done

Nobody has seen the app render. The Chrome extension is not connected to this
session; when it is, the browser walk-through takes minutes. Milestone 9's
Playwright suite covers it permanently.

---

### 8e - The appraisal form, and a clean database (2026-09-20)

Philipo sent `My_Care_Clinical_Appraisal_Form (1).docx` and reported that the
**physical copy is complete: every appropriateness item scored 4, and no
under-triage risk flagged on any of the 23 rules.**

**The digital file is the blank template.** Part A's name, affiliation,
signature and date lines are empty and every checkbox in Parts B and C is
unticked. The filled copy exists only on paper, so **the manuscript appendix
needs it scanned** - a blank template in the appendix would be a weak point at
defence.

#### The cross-check that matters

The form's rule table was compared row by row against the encoded ruleset in
`packages/ruleset/dist/v1.json`:

**23 of 23 rows match** - same presentation wording, same tier, same order.
6 home, 8 RHU, 9 emergency. **Zero mismatches.** What the reviewer appraised on
paper and what `evaluate()` actually runs are the same rule table.

#### The database was reset

The `mycare` database still held September's hand-made demo data, and it was
getting in the way: `demo-v1` had two symptom codes defined differently from
v1, so `mycare:ruleset:import` refused to redefine them (correctly - existing
codes are never overwritten by an import, and five synced sessions referenced
them). Its rules had no conditions at all, which is why the patient app showed
no chips and every triage fell to the `rhu` fail-safe.

With Philipo's go-ahead: `migrate:fresh --seed --force`, then import.

| Before | After |
|---|---|
| 1 barangay (Valladolid) | **15** — the seeded Carcar list |
| `demo-v1` published, 2 rules, **0 conditions** | **`v1` draft**, 23 rules, **23 conditions** |
| 5 fabricated sessions, 5 devices, 35 audit rows | 0, 0, 0 |
| 2 staff accounts | **0 — must be recreated** |

Two things were deliberately left for Philipo:

1. **The super-admin account.** `mycare:staff:create-super-admin` prompts for the
   password rather than taking an argument, so it never lands in shell history.
   Choosing or typing his password is not mine to do.
2. **Publishing v1.** Publishing writes the clinical-review attestation (ADR-0006)
   - who reviewed, and when. "All 4s, no risks" relayed secondhand is not an
   attestation; the reviewer's name and the form's date are.

**Until v1 is published, `GET /api/v1/ruleset/current` returns 503 and the patient
app cannot triage.** That was the accepted trade for a clean database. Once it is
published the symptom screen will offer chips for all 23 presentations. Free text
still matches nothing: `v1` carries **zero lexicon terms**, and those are the
reviewed ones Philipo will enter himself.

---

### 8f - One scale across all three apps (2026-09-23)

Philipo: "there's quite an inconsistency in the ui, try smoothing everything
out." The Chrome extension is not connected to this session, so this was an
audit of the stylesheets rather than of pixels - which turned out to be lucky,
because two of the findings were defects rather than drift.

#### Two actual bugs, found on the way

**`.mc-visually-hidden` and `.mc-row` are packages/ui class names, and the
patient app does not import packages/ui.** So in `apps/pwa`:

- the screen-reader-only labels on the symptom screen and the result screen had
  no styles at all, and were **rendering as visible duplicate text** - the
  symptom screen showed its own heading twice;
- Home's language pill and settings button had **no row layout**, because the
  class carrying `display: flex` did not exist. The inline `gap: 8` did nothing
  without it.

Both now use PWA-native classes (`.sr-only`, `.row-inline`) defined in the
app's own sheet. This is exactly the failure the CLAUDE.md layout rule predicts
when the two vocabularies blur: the patient app is excluded from the kit on
purpose, so borrowing a class name from it silently produces unstyled markup.

#### The drift

| | Before | After |
|---|---|---|
| Type sizes, patient app | 11 (11.5, 12, 12.5, 13, 13.5, 14, 14.5, 15, 15.5, 16 …) | 9 named steps, no fractions |
| Type sizes, staff kit | 12 (10, 11, 11.5, 12, 12.5, 13, 13.5, 14, 15, 15.5, 16, 17 …) | 9 named steps |
| Radii, patient app | 7 literals (11, 13, 14, 16, 18, 26, 99) | 4 tokens |
| Gaps, staff kit | 4, 5, 7, 8, 9, 10, 12, 14, 16, 18px | one 4px scale |
| Inline `style={{…}}` | **70** | **9**, all of them data |
| Side gutter, patient screens | 22px / 24px / 26px depending on screen | one `--gutter` |
| Hairline colour, patient app | 4 alphas (.07, .08, .09, .12) | `--line`, plus one deliberate `--line-strong` |

The most visible of these: `.title` carried a different margin on every screen
it appeared on - `18px 0 14px`, `22px 0 4px`, `18px 0 16px`, `18px 0 8px` -
so headings sat at a different height depending on where the patient was. It
is now one rule in the stylesheet.

#### Colours reconciled

Three tokens disagreed between the kit and the patient app for no reason:
ground (`#fbfaf7` vs `#f6f3ed`), hairline (8% vs 10% black) and the RHU tint
(`#fdf2e4` vs `#fdf0e1`). The patient app now uses the design canvas's values,
so a tier looks the same to a patient and to the health worker reading the
dashboard. **The two sheets stay separate** - same values, different token
names, no import - because CLAUDE.md excludes the kit from the PWA and that
rule is what the bundle budget rests on.

#### What deliberately stayed inline

Nine declarations, all of them data rather than styling: a ranked bar's width
(`${percent}%`), two legend swatch colours, and the six `grid-template-columns`
that give each ruleset editor its own column layout.

#### Verified

`npm test` 47 passed (console 4, portal 5, pwa 24, api-client 5, ui 9, plus the
engine, matcher and replay suites). Typecheck clean across ten workspaces. All
three apps build; the patient bundle is unchanged at 58.9 kB gzipped, 227 KiB
precached. Every size, radius, gap, padding and margin in all four stylesheets
now resolves to a token - the check for a stray literal comes back empty.

**Still unverified: how any of it looks.** Nothing here was seen rendered. The
two undefined-class bugs are the argument for Milestone 9's Playwright pass
sooner rather than later: both would have been obvious in a browser, and
neither was visible to 47 passing tests.

---

### 8g - Splitting "no signal" from "no rules" (2026-09-23)

Philipo, testing the patient app: *"when i choose a barangay, it needs internet
to continue."* Two separate things were happening.

**The real one, which is by design.** Confirming a barangay is the device's
first contact with the server: it registers anonymously and downloads the
ruleset. Without rules there is nothing to triage with, so a first run needs
connectivity once. Table 27's "None required for triage" is a claim about
triage, not about provisioning, and the app's own copy says so - *"needs an
internet connection the first time... After that it works offline."* The
honest phrasing for the defence: **one connection to provision, none to
triage.**

**The bug.** Every failure to fetch a ruleset was reported as "no internet",
including a `503` - a server that answered perfectly well and has nothing
published. So a patient with working signal was told to go and find signal,
and the fix (publish a ruleset) belongs to someone who is not in the room.
It also made testing confusing: perfect wifi, app still asking to connect.

`refreshBundle` now says why it has nothing:

| reason | what the patient reads | who can fix it |
|---|---|---|
| `offline` | "Connect once to get started" | the patient |
| `unpublished` | "Not ready yet" - connection is fine, nothing published yet | the health office |
| `server` | "Cannot reach the health office" | nobody on site |

A device that already holds a bundle is untouched: a failed refresh stays
silent and it keeps triaging offline, which is the entire point. Only a device
with nothing cached raises `BundleUnavailable`.

Verified against the live API, which returns exactly that 503 today:
`refreshBundle` reasons `unpublished`. 25/25 tests, including one that walks
onboarding against a 503 and asserts the connection message is **not** shown.
The Tagalog and Cebuano wording is draft, like the rest of `i18n.ts`.

#### Testing offline needs the production build

The dev server never registers a service worker, so going offline against
`:5173` proves nothing - the page simply dies. `vite.config.ts` gained a
`preview` proxy so the built app can still reach the API for that one
provisioning call:

```bash
npm run build -w @mycare/pwa
npm run preview -w @mycare/pwa     # :4173, /api proxied
# onboard online, then DevTools > Network > Offline, hard reload
```

---

### 8h - v1 published, and the whole chain verified end to end (2026-09-25)

Philipo created the super-admin and published `v1` through the console. This is
the first time the system has run as a system: a clinician-appraised ruleset,
published by a named actor, reaching a device, triaging on that device, syncing
back, and surfacing as aggregates.

#### The publish

`draft -> in_review -> published` at 12:11:20 UTC, `published_by_id = 1`, and
three audit rows naming `super@mycare.test`, each carrying the prior state in
`old_value`. Figure 41's reconstruction claim holds: the version's history can
be replayed from the log.

The attestation was given by Philipo, not by Claude. `RulesetLifecycle::publish()`
refuses without it and records who gave it; a sign-off recorded against someone
who did not give it would be worthless. The basis is the appraisal form
(see 8i below).

#### What was verified, against the live server

| | Result |
|---|---|
| Barangay list | 15, the seeded Carcar list |
| Device registration | anonymous, token `prefix.<secret>` (ADR-0005) |
| Bundle served (UT-013) | `v1`, **23 codes, 23 rules, every rule with a condition** |
| Tier split | **6 home / 8 RHU / 9 emergency** - matches the appraised table exactly |
| Chips (Figure 22) | **23**, one per presentation |
| Free text | matches nothing: **0 published lexicon terms**, as expected |
| On-device triage | `fever_mild` -> home (R-001) · `fever_persistent` -> rhu (R-007) · `chest_pain_severe_radiating` -> **emergency (R-016)** |
| Sync (UT-012) | accepted; payload carries codes, never text |
| Replay (UT-015) | same session uuid re-sent -> **no second row** (3 sessions, 3 distinct uuids, 5 batches) |
| **Offline triage** | with `fetch` throwing on every call: cached bundle triaged to **emergency**, session **queued**, and **flushed on reconnect** |
| Engine replay (ADR-0007) | `mycare:aggregate` produced rows carrying `outcome_tier` - `home: 2`, `emergency: 1` - recovered by replaying stored sessions through the real engine under Node, from a table that has no `outcome_tier` column |

That last row is the amendment-free workaround proving itself on real data for
the first time.

Two failures in the first pass were the verification script's fault - it used
the old demo data's symptom codes - and both showed correct behaviour anyway: an
unmatched code fell to the **`rhu` fail-safe, never `home`**, and the server's
422 for an unknown code left the batch **quarantined rather than retried
forever**.

#### Seeded data, so the dashboards show something

38 synthetic sessions across Valladolid, Can-asujan and Guadalupe, posted
**through the real device API** (register -> sync batch, two batches per
barangay) rather than inserted into MySQL, so they are shaped exactly like data
a handset would produce. Synthetic, local, and wiped by any `migrate:fresh`.

They are deliberately shaped so **both sides of the suppression rule are
visible** on today's bucket:

| Barangay | tier | raw | renders as |
|---|---|---|---|
| Valladolid | home | 8 | **8** |
| Valladolid | rhu | 1 | `<5` |
| Valladolid | emergency | 2 | `<5` |
| Can-asujan | home | 5 | **5** |
| Can-asujan | rhu | 2 | `<5` |
| Guadalupe | emergency | 3 | `<5` |

41 sessions, 14 devices, 11 batches, 99 aggregate rows.

#### One finding worth keeping

Aggregation reported 35 sessions from 41 stored, which looked like
undercounting. It is not: those 6 sessions have `completed_at >= 16:00 UTC`,
which is already the **26th in Asia/Manila**, so they belong to tomorrow's
bucket. `DateRange` converts once, at the boundary, and buckets by local day
because that is the day a health worker means (CLAUDE.md rule 6). The seed
script generated timestamps that spill past the local midnight; the aggregator
was right. Worth knowing before anyone reads a dashboard at 1am and files a bug.

#### Still unverified

**Every UI, in a browser.** The staff read paths need a signed-in session, and
the patient app has still never been rendered. Milestone 9's Playwright pass is
the only thing that closes this, and two bugs have already slipped through 48
passing tests for exactly this reason (8f).

---

### 8i - The appraisal form, and what it actually said (2026-09-25)

The completed appraisal arrived as structured JSON (a transcription of the
signed paper form, reviewer CR-01, signed 2026-08-20). **It did not say what it
had been remembered as saying**, and the differences mattered:

- **Part C was unambiguous and good:** all 23 rules rated **4, "highly
  appropriate"**, mean 4.0, zero needing revision, zero suggested tier changes.
  Cross-checked row by row against `packages/ruleset/dist/v1.json`: **23 of 23
  match**, presentation text and tier.
- **Part D item 2 was rated 1 (Strongly Disagree)** on the reverse-worded
  statement *"I am NOT aware of a dangerous presentation that the rule set would
  fail to escalate."* Read literally: the reviewer knew of something the rules
  would miss - and the field naming it was blank. Part D's mean was **2.5,
  "Disagree"**, in the one section about red-flag completeness.
- **Under-triage risk was marked "Yes" on 17 of 23 rules, including all 9
  Emergency rules** - impossible, since Emergency is the top tier. No suggested
  tiers, no comments.
- Part E's column-1 boxes were covered with correction tape.

The reviewer later clarified, remotely, that D2's wording had been misread and
that the Emergency rows should read "No". Those corrections were recorded in a
**separate corrected file with an audit trail** - original value, corrected
value, reason, who recorded it, and `signed_off_by_reviewer: false` until her
initials are on the paper. The original transcription was left untouched.
Neither file is in this repository: a signed appraisal naming a clinician and
her facility is field-study respondent data (CLAUDE.md).

**8 rows are still flagged "Yes" on non-Emergency rules** (7 RHU and one Home),
each rated 4 with no comment. The reviewer has not stated an intent for those,
and nobody should invent one for her.

#### The instrument was the problem, so the instrument was fixed

`My_Care_Clinical_Appraisal_Form_v1.1_2026-09-25.docx` (kept outside the repo
with the other appraisal artefacts):

- **Part D item 2 is positively worded** - "The rule set escalates every
  dangerous presentation I would expect it to escalate" - and its follow-up is
  now unconditional, asking for `NONE` in writing rather than leaving a blank to
  be interpreted.
- **The under-triage column states its own question** - "Could this rule send
  the resident to a LOWER level of care than they need?" - with the definition
  in the Part C instruction, including that a dangerous presentation correctly
  sent to Emergency carries no under-triage risk.
- **All nine Emergency rows are pre-filled "N/A - highest tier"** in a greyed
  cell. The invalid answer is no longer offerable rather than merely
  discouraged.
- A "Yes" now requires a suggested tier and a reason.
- Reviewers are asked to strike through and initial rather than use correction
  fluid.
- A version line records the revision, and a line of template boilerplate
  ("Example rows are shown in italics...") that should never have been in a form
  a clinician signs was removed.

Schema-validated against the original. **Not rendered** - no LibreOffice on this
machine - so the Part C header column may want widening; that needs a human to
open it once.

The `v1` publish rests on Part C, Part F ("Appropriate as presented") and the
corrected Part D. **What is still owed: the reviewer's initials on v1.1, one
written confirmation from her for the appendix, the 8 remaining flags, and a
scan of the completed form** - the .docx originally supplied was the blank
template.

---

### 9a - Every app in a real browser, and CI green (2026-09-26)

**Branch `feat/UT-012-offline-e2e`, PR #3.** This is Milestone 9 (Phase 8).

#### `main` was replaced first

At Philipo's instruction, `main` was force-pushed to
`feat/UT-020-laravel-api-schema` (`49b2d9a`), so PR #1 closed as merged. The old
`main` (`55abd3b`, PR #2's patient app and invented lexicon draft) is kept
locally as `backup/main-before-force-2026-09-26`. kizaru3214's
`feat/pwa-ui-polish`, pushed the same morning, is built on the replaced app
and needs a conversation, not a merge.

#### CI: why `main` went red, and the fix

The first push of Phases 4-8 to `main` failed **25 Pest tests**: the `api` job
never installed Node or built `packages/engine-replay`, so aggregation, reports,
surveillance and system health all found engine replay unavailable (ADR-0007).
This is the failure STATUS.md had predicted.

- `api.yml` sets up Node 20, builds engine replay and exports v1 before Pest.
- `engine-purity.yml` also typechecks, tests and purity-checks `lexicon-matcher`,
  the other half of the safety argument.
- `frontend.yml` (new) typechecks every workspace, unit-tests the packages and
  apps, and production-builds all three apps.
- `e2e.yml` (new) runs the Playwright suite below.
- Actions moved to the current majors (checkout v7, setup-node v7, cache v6,
  upload-artifact v7), past the `@v5` STATUS.md had pencilled in.

`api`, `frontend` and `engine-purity` passed on the first push to PR #3.

#### The E2E suite (`e2e/`)

Playwright 1.63 and Chromium. **Nothing is stubbed**: the Laravel API, a real
MySQL 8 schema, the patient app's production build with its service worker,
and the portal and console dev servers. Each runs on its own port
(8100 / 4273 / 5274 / 5275), so a run never collides with the dev servers or
touches the `mycare` database.

`global-setup.ts` rebuilds the world every run: it builds engine replay,
exports v1, runs `migrate` (which creates `mycare_e2e` if it is missing) and
`migrate:fresh --seed`, then `E2eSeeder`. The seeder publishes v1 and creates
two test staff accounts, and **refuses any schema but `mycare_e2e`**. The guard
was tested against the dev database and refused it. The publish is test
fixture, the same as Pest's in `mycare_test`. It is **not** a clinical-review
attestation.

| Spec | What it proves |
|---|---|
| `patient.offline.spec.ts` | Onboard with signal; v1 downloaded and cached (UT-001, UT-013). Network off plus a hard reload, so the app comes from the service worker. Triage home (R-001), RHU and emergency (R-016) by chip (UT-006). 3 queued, 0 on the server. Reconnect: **the server stores the batch but the response is dropped**, so the phone keeps its queue and retries with **the same batch uuid** → 3 sessions, 1 batch (UT-012, UT-015). No console errors beyond expected offline failures |
| `portal.smoke.spec.ts` | Sub-admin signs in; all five screens load; the dashboard shows `<5`; Sync & status says "Data is current"; no other barangay appears (UT-014, UT-016, UT-020) |
| `console.smoke.spec.ts` | Super-admin signs in; all six screens load; v1 published, the sub-admin listed, symptom codes present |

**6/6 pass locally, in about a minute.** Screenshots land in `e2e/screenshots/`
(gitignored), named for the manuscript figures they correspond to.

Symptoms are entered **by chip only**. v1 publishes no lexicon terms, and
test vocabulary may not be invented (CLAUDE.md), so **free text has no
browser test** until Philipo enters the reviewed terms.

**This does not prove Chrome 80 compatibility.** Playwright ships a current
Chromium. The run is at a 360×640 phone viewport with touch, and Chrome 80
still rests on the build target (`chrome80`) and a real handset.

#### What seeing the apps found

Every screen rendered and every test passed. Looking at the screenshots still
found things no assertion was written for:

1. **The result screen shows raw symptom codes to the patient.** The pill under
   the verdict reads `chest_pain_severe_radiating` / `fever_mild`, where the
   chip the patient tapped read "Severe chest pain radiating to arm or jaw".
   `Result.tsx` renders `codes`, not the labels `chipsFor()` already computes.
2. **Chip labels are the appraisal form's clinician wording**, in English
   whatever the language ("Animal bite, skin broken, patient stable, no rabies
   red flags"). They fall back to `displayName` because no lexicon terms exist.
   This is content, not code: it resolves when reviewed terms are entered.
3. **Settings: "Start over" touches the About card** above it, with no gap.
4. **A true zero shows as `<5`** on Sync & status ("Sessions waiting on
   devices") and on the console. This is the open zero-suppression question,
   now visible on a real screen.
5. The console's device row reads **Queued: "yes"** while the device holds
   nothing. It means "has reported a queue", which reads badly next to an empty
   queue.

Not a defect: in full-page screenshots the staff sidebar stops at the viewport
height. It is `position: sticky; height: 100vh`, correct when actually
scrolling.

#### Fixed in the same PR (Philipo approved items 1, 3 and 5)

- **1, raw codes:** `symptomLabel()` in `apps/pwa/src/triage.ts` is now the one
  place a code becomes the patient's label: the lexicon word in their language,
  then the display name, then the code only if the bundle does not know it.
  `chipsFor()` and the result screen both call it, so the two always agree.
  Long labels wrap inside the pill. Covered by a unit test and by Playwright
  asserting the pill's exact text.
- **3, spacing:** `.push` used `margin-top: auto`, which collapses to zero once
  the content above fills the screen. It now also has a minimum
  `padding-top`. All three screens that use it benefit. Playwright asserts the
  gap.
- **5 was a real bug, not wording.** Each upload sent `X-Pending-Sessions`
  set to the queue **including the batch being uploaded**. After a successful
  upload nothing corrected it until the phone's next ruleset check, so the
  server believed a phone that had sent everything still held its last batch.
  That is why the console said "yes" and the portal's "Sessions waiting on
  devices" read `<5` instead of zero. `sync.ts` now reports what will remain
  once the batch lands. The unit test that asserted the header was `> 0` had
  baked in the bug, and it now asserts the emptying batch reports `0`. The
  console column reads "Holding sessions: none / some waiting / not reported".
  It stays yes/no deliberately, because a per-device count under 5 would get
  round suppression.

Items 2 (chip wording) and 4 (true zero) remain Philipo's: content and an open
decision, not code.

---

### 9b - Deployment, proven by deploying (2026-09-26)

**Branch `feat/UT-011-deployment`, PR #4.** This is Milestone 10 (Phase 9).
Philipo chose **a guide with no server yet** and **one host split by path**.

#### The layout

| Path | Serves |
|---|---|
| `/` | patient app (`apps/pwa/dist`) |
| `/portal/` | sub-admin portal |
| `/console/` | super-admin console (moved from `/`, the only app code change) |
| `/api/`, `/sanctum/`, `/up` | Laravel through PHP-FPM |

One origin means the staff session cookie needs no `SESSION_DOMAIN` (ADR-0004
records this as Phase 9's precondition) and one certificate covers everything.
Figure 36's `admin.` subdomain is an illustration, as ADR-0004 already says.

#### What was written

- `deploy/nginx/`: `mycare-app.conf` (the locations, shared),
  `mycare-headers.conf`, `mycare.conf` (production HTTPS) and `mycare-ci.conf`
  (localhost HTTP for CI).
  - Only Laravel's `index.php` ever executes.
  - `sw.js`, `index.html` and the manifest are never HTTP-cached, because a
    phone stuck on an old service worker is stuck on old triage code.
  - `Permissions-Policy` refuses geolocation, camera and microphone.
  - Security headers live in a snippet included per location, because nginx
    drops a server block's `add_header` in any location that sets its own. The
    first draft had HSTS at server level, where it would never have been sent.
- `deploy/php-fpm/mycare.conf`: its own pool, and **`env[PATH]`**. PHP-FPM
  empties the environment by default, and engine replay needs `node`. This is
  the Linux version of the Windows `artisan serve` problem in STATUS.md.
- `deploy/cron/mycare`: the scheduler every minute, and a nightly backup.
- `deploy/backup.sh`: `mysqldump --single-transaction`, 14 days kept.
- `deploy/env.production.example`: `APP_DEBUG=false`, secure cookies, a
  dedicated DB user. Every line that differs from development is marked.
- `deploy/deploy.sh`: an idempotent build and release, run as root, with
  runtime files written as `www-data`. It generates `APP_KEY` on the first run
  and uses maintenance mode during the release.
- `docs/DEPLOYMENT.md`: the guide, from a fresh Ubuntu 24.04 through HTTPS,
  first run, checks, backups and restore, updates and rollback, security,
  troubleshooting, and the defence demo.
- `E2eSeeder` now guards on the schema name alone (still `mycare_e2e` only), so
  it can run against a deployment configured as production.
- `composer.json`: the dead `database.sqlite` line is gone (a STATUS.md item).

#### `deploy-smoke`: the guide, executed

A new workflow sets up a fresh Ubuntu 24.04 runner with the guide's own
commands and the committed `deploy/` files, runs `deploy.sh`, checks what nginx
serves (status codes, SPA fallbacks, headers, `/.env` refused, no stack traces
with `APP_DEBUG=false`), then runs the **whole Playwright suite through nginx**
(`E2E_BASE_URL=http://localhost`). The only departures from production are the
ones CI cannot avoid: no public host name, so plain HTTP on `localhost` (where
service workers are still allowed) and no certbot.

It earned its place at once. Each of these would have failed on a real server:

1. **Line endings.** Files edited by script on Windows were committed with
   CRLF: bash would read `#!/usr/bin/env bash\r`, cron ignores such files, and
   PHP-FPM would get a socket path ending in `\r`. This included files merged
   in PR #3. They were restored to LF, and `.gitattributes` now forces LF for
   `deploy/**`.
2. **`artisan optimize` fails on this API.** It also runs `view:cache`, and
   `apps/api` has no `resources/views`. `deploy.sh` caches config, routes and
   events explicitly.
3. **The runner's own Node and apache2.** The runner image ships a newer Node
   first on PHP-FPM's `PATH`, and apache2 on port 80. CI now installs Node 20
   from NodeSource as the guide does and stops apache2. A server built from
   the guide has neither problem, but this is exactly the sort of drift the
   job exists to catch.
4. **Test harness:** tinker, run as `www-data`, needs a writable `HOME`.
5. **Every phone upload would have been rejected: the real find.** Through
   nginx, the patient app onboarded and triaged offline, but its sync POST got
   **419 (CSRF token mismatch)**. `statefulApi()` applied Sanctum's session
   and CSRF middleware to every `/api` request from a first-party origin, and
   on one host the patient app *is* first-party. Locally it ran on another
   port, and Laravel skips CSRF under test, so neither 176 Pest tests nor the
   E2E suite could see it. With Philipo's approval, the stateful middleware
   now sits on the `staff` and `console` route groups only, so devices never
   get a session (and anonymous phones no longer receive a session cookie).
   `DeviceStatelessTest` was written first and failed 4 of 5 before the fix.
   ADR-0004 carries the amendment and the rejected alternative.

**Result: deploy-smoke green.** A fresh Ubuntu 24.04 machine, built with the
guide's commands and the committed files, deployed by `deploy.sh`, passes every
layout and header check and **all 6 Playwright tests through nginx**: offline
triage, upload on reconnect, a dropped response retried without
double-counting, and both staff apps. Pest 181/181.

**What still needs a human:** a real server, a domain and its certificate,
and the first-run steps in DEPLOYMENT.md §8 (super-admin password, the v1
publish attestation, facilities CSV, lexicon terms, sub-admin accounts).

---

### 9c - The barangay list ships in the app (2026-09-26)

**Branch `feat/UT-001-bundled-barangays`.** Philipo asked why the barangay
screen was empty. The cause was that the API wasn't running, and the patient
app loads the list from it. He then chose to ship the list inside the app, so a
phone can choose its barangay before it has ever had signal.

**Names only, never ids.** A barangay's id is an auto-increment number from
whichever server seeded it (in `BarangaySeeder` insertion order), and the City
Health Office may still correct the list. A shipped id could count every
session under the wrong barangay. So:

- `apps/pwa/src/barangays.ts` ships the 15 names. `barangays.test.ts` reads
  `BarangaySeeder.php` and fails if the two lists drift.
- A choice from that list is saved with `id: null` (`ChosenBarangay`).
- **`completeSetup()`** resolves the id by name from the server's list at first
  contact, then registers and pulls the rules. It runs on confirm, when the app
  opens with setup unfinished, and on every `online` event.
- If the server has no such name (renamed or removed), the choice is cleared
  and the patient is asked again, with a new `barangayNotFound` string. It is
  never guessed. The `tl` and `ceb` wording is a draft, like the rest of
  `i18n.ts`.
- `finishCheck()` refuses to record a session without a server id. In practice
  this can't happen (the rules only arrive after the id is resolved), but the
  guard makes it impossible.
- The emergency result screen accepts a missing id and falls back to the
  city-wide number or 911. It is never withheld.

**An existing gap this closed.** Before this change, a phone that confirmed its
barangay offline never retried registration, not on restart and not on
reconnect. It sat on "needs a connection" until Start over. Shipping the list
makes choosing offline the normal path, so setup now finishes by itself when
signal returns.

**What did not change:** the first run still needs signal once, for the
published rules and registration. That is deliberate: the rules a phone
triages with must be the version a person published with the attestation.
Shipping v1 as a fallback was discussed and left for Philipo and his adviser.

**Tests:** `barangays.test.ts` (5) and two journeys in `app.test.tsx`
(onboarding offline and finishing on reconnect; the rename case). A new
Playwright spec, `patient.first-run-offline.spec.ts`, covers a phone that
installed the app, lost signal before onboarding, chose offline, and
registered under the server's real Valladolid id once signal returned. The
barangay screen no longer shows the "needs a connection" banner just because
the background fetch of the server list failed. PWA 33/33, E2E 7/7.

Also found while looking: VS Code's built-in browser is a webview and did not
load the list; Chrome did. Only Chrome and real phones count.

---

### 9d - End of session (2026-09-26)

**Merged today:** PR #3 (Phase 8), PR #4 (Phase 9), PR #5 (the shipped
barangay list), plus docs commits straight to `main` at Philipo's request.
`main` is green on all five CI checks: `api`, `frontend`, `engine-purity`,
`e2e`, `deploy-smoke`.

**Two local-run problems Philipo hit, both environment rather than code:**

- **VS Code's built-in browser** did not load the barangay list; Chrome did.
  It is a webview, not a full browser. Use Chrome, or a phone.
- **"Cannot reach the health office"** turned out to be the API on **port
  8001**. `php artisan serve` quietly moves to the next free port when 8000 is
  taken (an earlier API process still held it), and the Vite proxies look on
  8000, so they answered 502. The app's message was the accurate one (a
  server problem, not missing signal). Start the API with `--port=8000` so it
  fails loudly instead of moving. Added to STATUS.md's environment notes.

**Transcript:** `my-care-session-transcript-2026-09-26.txt` (untracked, like
the others), generated from the session log. The real `APP_KEY` appeared
twice in the log, printed when `.env.testing` was read. It is redacted in the
transcript. The dev `.env` shares the same key; it is local-only, but rotating
it with `php artisan key:generate` costs nothing but a sign-in.

**Next session starts with** whatever Philipo picks from STATUS.md's next
steps: a server and domain, the lexicon terms, the conversation with
kizaru3214, or porting the icons, language pill and age-gate layout from his
branch (a plan first).

---

### 9e - Free text, tested with an invented TEST lexicon (2026-09-27)

**Branch `feat/UT-003-test-lexicon`.** Philipo typed "hilanat" and nothing
happened: v1 publishes no lexicon terms, so free text matches nothing. He
asked to "fully test the capability" with the terms that already exist, for
testing only. The only ones that exist are kizaru3214's invented draft from
PR #2 (`f1d0a0a`, still on `origin/feat/pwa-ui-polish`): 124 terms covering
all 23 v1 codes in English, Tagalog and Cebuano, with negations.

**Copied unchanged, fenced off:**

- `packages/ruleset/src/testing/lexicon-fixture.ts`: the draft with a new
  header (TEST FIXTURE ONLY, where it came from, who approved it, the known
  clinical problems). Not one term was changed, added or translated.
- Reachable only through a second entry point, `@mycare/ruleset/testing`
  (package `exports`). `testing.test.ts` fails if `v1Bundle.lexiconTerms`
  stops being empty or if the main entry ever mentions `testing`.
- `v1TestLexiconBundle` = v1 exactly, plus the fixture. A test pins that
  nothing else differs.

**Known clinical problems in the fixture, written into its header:** a bare
"fever" / "lagnat" / "hilanat" is `fever_mild` (home), so a patient with a
serious fever who types only that word is under-triaged; a bare "chest pain"
is straight emergency. Fine for a test, never for a patient.

**Tests:**

- `apps/pwa/src/free-text.test.ts` (17): the patient's words through the
  real matcher, the real v1 rules and the real engine, in all three
  languages; UT-003 (`sip-on`), UT-004 (`walay hilanat`), a longer phrase
  winning ("dugay na hilanat" is RHU, not home), mixed languages taking the
  highest tier, unknown words resolving to nothing. Two tests pin the
  fixture's limits so nobody reads them as correct: README's own example
  "hilanat ug ubo, tulo ka adlaw na" comes out **home** because nothing
  encodes the three days.
- `e2e/tests/lexicon.free-text.spec.ts` (4), a third Playwright project run
  after staff: import the bundle as a draft, then in the console open it
  (Lexicon (124)), submit, publish with the attestation checkbox (UT-011); a
  new phone onboards, downloads it (UT-013), goes offline and triages free
  text to home, RHU and emergency; the three sessions upload against the new
  version, each with its `matched_term_id`. Skipped against a deployed host.
- `e2e/support/env.ts` gained `scalar()`; `count()` now uses it.
- CI's `frontend` job runs the ruleset tests.

Test inputs use only fixture terms, commas, and README's manuscript example.
No new Cebuano or Tagalog was written.

**For trying it by hand:** `npm run export:test-lexicon -w @mycare/ruleset`
writes `dist/v1-test-lexicon.json` (gitignored). Imported with
`mycare:ruleset:import` it becomes the next draft (**v2**: labels are
assigned in order, and `RULESET_VERSION` has no column that could mark it as
a test). Publishing it is Philipo's own attestation, in his development
database only. Two things found along the way:

- **A phone refreshes its rules at most every 6 hours** (`sync.ts`,
  `refreshBundle`). A phone that already holds v1 keeps it after v2 is
  published until then, or until Start over. Not changed.
- **Chips take their label from the lexicon** (`symptomLabel`), so with the
  fixture published they read "fever", "chest pain", "cold" instead of v1's
  clinician wording. Under the fixture that is the same short-chip risk
  noted against `feat/pwa-ui-polish`: a "fever" chip is home. The reviewed
  terms should settle which word a chip shows. Not changed.

**Results:** ruleset 4/4, PWA 50/50, E2E 11/11 locally, typecheck clean.

---

### 9f - Line icons and a language pill (PR #7, 2026-09-28)

**Branch `feat/UT-006-pwa-icons-language-pill`.** The two ideas worth taking
from kizaru3214's `feat/pwa-ui-polish` (STATUS, 2026-09-26), rebuilt on the
current app rather than merged.

- **`screens/Icon.tsx`:** inline SVG line icons. Ten paths are his, byte for
  byte (checked against his file); alert, x, plus and circle are new. They
  replace every emoji and text glyph: back, gear, map pin, search, the
  offline badge (tick online, circle offline), chip tick and plus, the three
  result marks (house, clinic, warning triangle), phone, and the tip mark.
  Emoji render differently on every Android build; a stroked path does not.
- **`LanguagePill`** (`screens/parts.tsx`) on Home, symptom input,
  clarification, result and tips. It opens the three languages in place.
  Typed text and taps are kept. An open clarification question is re-asked in
  the new language by its key (`localizedQuestion` in `triage.ts`); answers
  are still sent by position (ADR-0006), so a switch cannot change a tier.
  The session is recorded in the language the check finished in.
- **No new copy:** the pill's accessible name reuses the existing "Language"
  string ("Language: English"), so no tl/ceb draft was needed.
- **Left as text on purpose:** the ✓/✕ line under the free-text box, which
  #6's Playwright spec reads.
- **Found by the phone screenshots, fixed:** wrapped chip labels centred once
  the chip became a flex row, and the result screen's menu opened off the
  left edge. Playwright now checks the menu stays inside 360px on the symptom
  and result screens (`22c`, `27c`).
- **Two old test races surfaced under the extra load, fixed:**
  `getByRole("Padayon")` straight after an async language save (now
  `findByRole`), and a previous test's offline upload landing in the next
  test's capture through the shared fake IndexedDB. The second first looked
  like a session recorded in the wrong language; logging the batches showed
  it was the earlier test's. The new test counts only its own session.
  `main` itself had been stable.

**Results:** PWA 35/35 (six runs in a row), E2E 7/7.

---

### 9g - kizaru3214's PR #8: wide screens, mic notice, change barangay (2026-09-29)

**Written by kizaru3214, merged by Philipo.** Reviewed after the merge:

- **Wide-screen layout** from 768px (two-column Home from 1024px). CSS only;
  phones unchanged.
- **Mic button in the symptom box** that records nothing and says voice input
  is not supported yet. It reverses the "no microphone" decision (9a era),
  as an explained non-feature: no audio is captured, so the privacy
  reasoning still holds. Accepted by merging.
- **"Change barangay" in Settings** without Start over. Sessions carry their
  own `barangay_id`, so counts stay right, and unsent checks keep theirs.
- **`completeSetup` fix:** a registered phone holding an offline-picked
  barangay (no server id) now resolves it instead of returning early.
- New gear icon; three new strings (`voiceInput`, `voiceNotSupported`,
  `changeBarangay`), tl/ceb drafts like the rest.

**Gap found in review:** DEVICE.barangay_id did not move with the patient.
Sync & status (Figure 33) and the console's system health group devices by
it, so the old barangay kept a phone reporting elsewhere and the new one never
saw it (UT-014 figures wrong for both). Fixed in 9h. #8 also added no tests;
9h covers change-barangay.

---

### 9h - The device moves with the patient (PR #9, 2026-09-29)

**Branch `feat/UT-014-device-barangay-move`.**

- **`PATCH /api/v1/devices/current`** (`CurrentDeviceController`,
  `MoveDeviceRequest`), behind the device-token middleware. It changes only
  `barangay_id`, which must exist; anything else sent is ignored. The model
  observer audits it with no actor (a device is not an account). A replayed
  move is a no-op, so no second audit entry. No schema change: the column is
  Table 12's own.
- **PWA:** `ensureRegistered()` moves an existing registration when the
  chosen barangay differs from the one the credential was issued for.
  `setupPending()` (`sync.ts`) counts that, an offline-picked barangay and
  no registration as unfinished setup, and drives `completeSetup` at startup
  and on reconnect. So an offline change finishes by itself, the same path
  as an offline first run. The phone never registers twice.
- **Tests:** Pest `DeviceMoveTest` (8, including the device moving between
  the two barangays' Sync & status); PWA `sync.test` (4) and two
  `app.test` journeys (with signal; offline, triaging under the new barangay,
  then the move on reconnect); Playwright `patient.change-barangay.spec.ts`
  (moves with signal, then offline, checking the database each time and that
  the device count did not grow).

**Results:** Pest 189 passed / 760 assertions, PWA 58/58 (three runs in a
row), E2E 12/12, all five CI checks green. Merged as `b89a53d`.

---

### 9i - End of session (2026-09-27 to 2026-09-29)

**Merged:** PR #6 (free text with the invented TEST lexicon, 9e), PR #7 (line
icons and the language pill, 9f), PR #8 (kizaru3214: wide screens, mic notice,
change barangay, 9g; merged by Philipo, reviewed after), PR #9 (the device
moves with the patient's barangay, 9h). Docs straight to `main`: the
README's Playwright section (`e7ddb27`), BUILD-LOG 9f to 9h and STATUS
(`84bd44b`), and the final docs pass (`426ee8e`: README, REPO.md,
CONTRIBUTING). All branches kept. `main` green on all five CI checks.

**What Philipo hit while testing by hand, and what it was:**

- **"Not letting me choose a barangay, it already chose one":** his Chrome
  had finished onboarding earlier (Valencia), so the app opened on Home. At
  the time the only way back was Settings, Start over. PR #8 then added
  "Change barangay"; PR #9 made the server follow.
- **"Typed hilanat and it's not working":** v1 publishes no lexicon terms,
  so free text matched nothing. That led to 9e. To try it by hand he needs
  `npm run export:test-lexicon`, the import (it becomes the next draft, v2),
  a publish in the console with his own attestation, and Start over (or
  wait 6 hours) so the phone fetches the new version. Whether he did this in
  the development database is not recorded here.

**Decisions made this session:**

- The invented draft lexicon may be used **for tests only**, fenced off
  behind `@mycare/ruleset/testing` (Philipo, 2026-09-27). Recorded in memory.
- The explained, non-recording mic stays (accepted by merging #8).
- Docs follow-ups continue straight to `main`; code through PRs with merge
  commits; branches kept.

**Open, for next session** (STATUS has the full list): a server and domain;
which word a chip shows once reviewed terms exist (the lexicon word makes a
bare "fever" chip home); the reviewed terms themselves; native review of the
tl/ceb copy including #8's three strings; the 6-hour rule refresh; the
CODEOWNERS usernames; zero suppression; the two manuscript `.docx` edits.

**His Chrome's development state** (localhost:5173): onboarded as Brgy.
Calidngan, in Cebuano, left on the symptom input screen. Nothing was
triaged or published from this session's browser checks.

**Transcript:** `my-care-session-transcript-2026-09-29.txt` (untracked, like
the others), generated from the session log with secrets redacted.

---

### 9j - kizaru3214's PRs #10 to #12, and the Start over hang (PR #13, 2026-10-23 to 2026-10-25)

All three are kizaru3214's. Philipo merged #10 (2026-10-23) and #12
(2026-10-25); kizaru3214 merged #11 himself, with no review, the same evening.
Reviewed afterwards in this session; nothing found that needed reverting.

**PR #10, QA consistency pass** (`f72f657`):

- `apps/api/.env.example`: `SANCTUM_STATEFUL_DOMAINS` gains `localhost:5174`
  and `localhost:5175`, so a fresh setup can sign in to the portal and
  console. BUILD-LOG documented it; the example never had it.
- Patient app: a 429 on device setup is its own blocker, `busy` ("Too many
  tries for now, wait about an hour"), instead of "Cannot reach the health
  office". `classify()` in `sync.ts` is exported and tested (`sync.test`).
- Change barangay from Settings no longer shows onboarding's "Step 3 of 3".
- STATUS: the "no microphone" decision records PR #8's amendment.
- CODEOWNERS: `@PHILIPORACOMA` and `@kizaru3214` filled in. Binghay's and
  Seaborg's are still placeholders, so `/apps/api/`, `/apps/pwa/`, `/docs/`,
  `/.github/` and the default owner request nobody.

**PR #11, service worker off the other apps** (`1a357f6`): on one host
(DEPLOYMENT.md) the installed patient app's `navigateFallback` answered
`/portal/` and `/console/` with its own `index.html`. The denylist is now
`/^\/(api|sanctum|portal|console)(\/|$)/` plus `/^\/up$/`. Would have broken
both staff apps in production.

**PR #12, patient app fixes** (pushed to the same branch after #11 merged):

- Typed words the lexicon does not know now say so (`noWordsMatched`) and
  point at the chips. With v1's empty lexicon, that is anything typed.
- The health-tips button shows only when `tipsFor()` returns something.
  None exist yet, so it is hidden everywhere for now. Tested.
- A "mycare" database that is not ours (an older or foreign build at the
  same version, other stores) used to leave the app spinning forever.
  `open()` now rejects it and a new `StorageErrorScreen` offers Try again
  or Start over (confirmed), which deletes the database. Tested.
- Background sync swallows that rejection instead of an unhandled error.
- The age gate takes kizaru3214's layout from `feat/pwa-ui-polish` (person
  mark, question and answers mid-screen) and the language pill.
- **Demo mode**, `npm run dev:demo -w @mycare/pwa` (`apps/pwa/src/demo.ts`):
  loads the PR #2 invented lexicon from `@mycare/ruleset/testing` plus
  draft tl/ceb names for all 23 chips, on the device only, and only when the
  bundle has no lexicon of its own. **Not clinically reviewed.** Merging it
  was Philipo's call; it widens 9e's tests-only exception to local demos.
  Checked: a normal `vite build` contains none of the vocabulary (the import
  is dead code outside `--mode demo`; only the property name survives). The
  draft chip names translate clinical wording and are never a source for
  the reviewed terms.

**PR #13, Start over no longer looks dead** (this session, branch
`fix/UT-001-storage-start-over-hang`): `deleteStorage()` had no `onblocked`
handler, so while another tab held the database the delete waited and the
button appeared to do nothing. It now takes an `onBlocked` callback; the
screen says "Another My Care tab is still open. Close it, and starting over
finishes by itself", and the queued delete reloads the app once that tab
closes. My Care's own connections close on `versionchange`, so one My Care
tab never blocks another. New `app.test` case holds a foreign connection
open; it fails on `main` and passes on the branch. tl/ceb strings are drafts.

**Results:** PWA 64/64 on the branch (63 on `main` after #12), typecheck
clean; #12 green on all five CI checks before merge. Production build
verified free of demo vocabulary.

**Still open, added to STATUS:** native review of the new tl/ceb strings
(`busyTitle`/`busyBody`, `noWordsMatched`, `tryAgain`, `storageErrorTitle`/
`storageErrorBody`, `storageBlocked`, and demo.ts's chip names if they are
ever shown to anyone outside a demo); Binghay's and Seaborg's GitHub
usernames for CODEOWNERS.

---

### 9k - Sentences, more demo phrases (PR #14), and a negation bug found (2026-10-25)

**What Philipo hit:** "abdominal pain" typed in demo mode was not recognised.
Not a fault. The demo vocabulary only knows the *severe* presentation
("severe stomach pain", "grabe nga sakit sa tiyan"), and v1 has no code for
ordinary stomach pain, only `abdominal_pain_severe_rigidity` (emergency).

**What the matcher does, measured:** it finds known phrases anywhere in a
sentence, several at once, with typos, split words and negation. It does not
skip an extra word inside a phrase ("grabe **kaayo** nga sakit sa tiyan"),
read affixed forms ("hilanaton"), or paraphrase. That is by design: the
device limits rule out a language model, and no probabilistic model may near
the tier decision. Coverage comes from the lexicon.

**PR #14** (`feat/UT-003-demo-phrases`, demo mode only): 286 more phrases
across the 23 presentations, en/tl/ceb, Claude's draft at Philipo's request.
Invented and unreviewed, like the rest of `demo.ts`. Each keeps its code's
severity; plain "sakit sa tiyan" is deliberately absent; no negation phrases.
A test types every phrase alone and requires exactly its own code.

**Bug found, not yet fixed — under-triage risk:** with the test lexicon,
**"naay hilanat" ("I have a fever") is read as NOT fever.** `matchAt`'s
joined-string path compares "naayhilanat" with the negation "walayhilanat",
12 letters long, so 2 edits are allowed; they are exactly 2 apart. Any
reviewed lexicon has the same exposure, because the cause is the matcher, not
the terms. A fix (negations never match through the fuzzy joined path) and a
gap-tolerance proposal are with Philipo as a plan, awaiting approval.

---

### 9l - Matcher plan approved and built: PRs #15 and #16 (2026-10-25)

Philipo approved the 9k plan with **one** extra word.

- **PR #15** (`fix/UT-004-negation-exact`): a negation matches only word for
  word or as an exact run-together join. "naay hilanat" is now fever
  present; "wala hilanat", "walay hilnat" and "walayhilanat" still negate.
- **PR #16** (`feat/UT-003-phrase-gap`, built on #15, merge #15 first): a
  positive phrase of 2+ words may take one extra word that names no symptom
  of its own, inside one clause. **ADR-0008** records the rules. A test
  caught a flaw in the planned two-pass order (the plain "sakit sa tiyan"
  beat the severe phrase), so each term now tries exact then gapped before
  any shorter term. **Flagged for clinical review:** an intensifier as the
  extra word ("sakit **kaayo** akong ulo") lands on the plain phrase's code;
  the reviewed lexicon should list intensified forms.

Open PRs, merge order: #13 (Start over hang), #14 (demo phrases), #15, then
#16. All JS workspaces pass on each branch; typecheck clean.

---

### 9m - Demo stomach-pain question (PR #17), and #13 to #17 merged (2026-10-25)

**PR #17** (`feat/UT-005-demo-clarification`, demo mode only): **invented
clinical logic at Philipo's request**, not from the appraisal form, not
reviewed. A demo symptom `demo_abdominal_pain` (needs clarification) for
"stomach pain", "stomach ache", "sakit sa tiyan", "sakit ng tiyan" and so
on, plus a chip. It asks "How bad is your stomach pain?" in en/tl/ceb: mild
or strong gives RHU (`R-DEMO-1`), "severe, or my belly is hard and painful
to touch" is the red flag, which gives emergency. No answer gives home. Checks that use it
**never sync** (`isDemoOnly`): `BatchIngestor` rejects a whole batch naming
an unknown symptom code or question, which would hold every real check
queued behind it.

**Merged by Claude at Philipo's instruction** (`gh pr merge --merge`, in
order, branches kept): #13 (Start over hang), #14 (demo phrases), #15
(negation fix), #16 (one extra word, ADR-0008), #17. `main` = `1dfa271`.
On `main`: all JS workspaces pass (PWA 68, matcher 19), typecheck clean, and
the production build contains no demo content. The e2e failure on `6e531f7`
was a flake: the rerun passed with no change.

**Still awaiting Philipo:** the option 2 plan (an unrecognised check
continues to the RHU fail-safe instead of a dead end); a real ordinary
abdominal pain presentation, its question and tiers from the clinical
appraisal.

---

### 9n - Unrecognised words reach the RHU fail-safe (PR #18); demo follow-ups (PR #19) (2026-10-25)

**PR #18** (`feat/UT-002-unrecognised-continue`, option 2, approved): text
the lexicon recognises none of can continue. With no symptom the engine
gives RHU, never home (ADR-0001). The result adds "My Care could not
recognise your symptoms… If they are severe or getting worse fast, go to
the nearest hospital now." **That line is medical advice and needs clinical
review**; tl/ceb are drafts. A negation alone ("walay hilanat") still
disables Continue (UT-004's e2e step). The session syncs with
`symptoms: []`; `replay.test.ts` already proves it replays to rhu. PWA
70/70, Playwright 12/12 locally. A new app test was flaky under full-suite
load: an earlier test's queued check retried into its fetch stub. It now
looks for its own session instead of the first batch.

**PR #19** (`feat/UT-005-demo-followups`, demo mode only, **invented
clinical logic at Philipo's request**): eleven follow-up questions on
fever, cough, diarrhea (number of days/weeks, moving the check to RHU past
v1's own cut-offs via R-DEMO-2 to R-DEMO-4) and on headache, minor wound,
high blood pressure, spotting, thirst (yes/no red flags giving emergency).
They can only raise a tier. Number buttons because the engine compares
answers as numbers. Checks that answered a demo question never sync.

Merge order: #18 and #19 are independent of each other.

---

### 9o - Lexicon appraisal form (Batch 2), run commands (2026-10-25 to 11-07)

No code changed. PRs **#18 and #19 are still open**, CI green on both,
waiting for Philipo to merge.

**`RUN-COMMANDS.txt`** at the repo root: every terminal command to set up,
run, test and troubleshoot the system. Untracked; Philipo has not said
whether to commit it.

**Lexicon Appraisal Form, Batch 2** (for a second health professional).
Final file: `C:\Users\epica\Downloads\My_Care_Lexicon_Appraisal_Form_Batch2_2026-11-05_final.docx`
(+ `.pdf`), built inside the v1.1 form's own .docx package so fonts, page,
margins and table style match exactly; 5 pages. Two older copies sit beside
it (`..._2026-11-05.docx`, `..._v1style.docx`), kept until Philipo says.
Decisions, in order (Philipo's):
- **Philipo translates the vocabulary himself** (allowed: CLAUDE.md says the
  terms come from him or the appraisal). The appraiser has little time.
- **Only the 9 emergency presentations** ask the appraiser for words (Part B:
  commonly described? Y/N/Unsure, words residents use, comments), because a
  missing word there sends an emergency to the RHU fail-safe. The 14
  home/RHU presentations' words go unreviewed: an accepted trade-off.
- Part C: 7 follow-up candidates (fever days, cough weeks, diarrhea
  dehydration, wound infection, headache red flags, spotting, animal bite):
  needed? Y/N, question, **answer choices**, emergency answer.
- Part D: 25 common adult complaints v1 lacks (ordinary stomach pain first)
  + 2 Other: include? Y/N, tier H/RHU/E, follow-up? Y/N. The complaint list
  is Claude's suggestion; the tiers are the appraiser's recommendation.
- Part E: three 1-4 statements, "dangerously misread words" (write NONE),
  comments. Part A and the attestation copy v1.1's.

**When the completed form comes back,** mapping to the schema:
- `LexiconTerm` needs `language` and `isNegation` per term: Philipo tags them
  and writes the negations ("walay ...") when entering terms.
- `ClarificationQuestion` needs en/tl/ceb variants with the same
  `allowedAnswers` order (English first, ADR-0001 / `canonicalAnswer`):
  Philipo translates. A duration question's answers must compare as numbers.
- Part D complaints become **new symptom codes and rules**: plan first per
  CLAUDE.md, and log the appraiser as the clinical source.

An earlier, superseded draft also exists as a Claude doc
(https://claude.ai/artifact/MBxLU7dGmAG149oSWTbc6P). Philipo has not said to
delete it.

---

### 9p - Batch 2 form back; ruleset v2 draft from Part D (2026-11-07)

**The completed Lexicon Appraisal Form (Batch 2) came back** (4 photos, so one
page is likely missing). Appraiser: a nurse with under 3 years' experience; the
attestation is ticked, **"agree to be named" is not**, so neither the
manuscript nor the repo names them. Dated 11/04/26, a day before the form's
own date of 5 Nov.
- **Part B:** all 9 emergency presentations "commonly described: Y", but
  **no words were written for any of them**. The emergency vocabulary is
  still owed.
- **Part C:** all 7 follow-ups ticked "needed". The handwriting is mostly
  unreadable, so **Philipo will type the wording out**. The legible points:
  spotting should ask how many pads are soaked, not the amount; for an animal
  bite, "Do not wait for danger signs. Consult immediately".
- **Part D:** all 25 complaints marked "include", each with a tier and
  "follow-up: Y".
- **Part E:** coverage 4, follow-ups acceptable 4. **"Residents can describe
  these in a few typed words well enough to tell them apart": 2 (Disagree).**
  The answer belongs in the manuscript's Discussion or Limitations. The
  "dangerously misread words" line is blank.

**Ruleset v2 draft** (PR #20, `feat/UT-005-ruleset-v2-batch2`, approved plan):
`packages/ruleset/src/bundle/v2.ts` = v1 unchanged + 26 new atomic symptom
codes and rules R-024 to R-049, labelled `v2-draft`. It has the appraiser's
Part D tiers, with two of Philipo's readings: "insect sting or snake bite" (RHU
and E both ticked) is split into insect sting → rhu and snake bite →
emergency; back pain (faint tick) → home. Totals: 13 home, 21 rhu,
15 emergency. **Burns and heartburn go to emergency as ticked**, a cautious
call by the appraiser.
- No follow-up questions yet: the escalation comments (pain over 24 hours,
  abdominal distention, tinnitus or hearing loss, rule out cardiac) wait for
  Part C. No lexicon terms (none came back) and no health tips. The new
  presentations show as English chips until terms are entered; typed text that
  matches nothing still goes to RHU.
- `npm run export:v2 -w @mycare/ruleset` → `dist/v2.json`, then
  `mycare:ruleset:import` as a draft and publish from the console. CI and
  `deploy.sh` now export v2 too. Nothing imports it automatically.
- Tests: engine (every v2 tier, the 26 checked against a list typed from the
  form), ruleset (v1 untouched, unique codes, column widths), Pest (import
  gives 49 rules: 13/21/15). The check screen now shows 49 chips.
- **One appraiser, unreviewed:** a draft for clinical review, not validated.
  The manuscript's "23 presentations" describes v1 only.

---

### 9q - Symptom chips grouped by body area (PR #21) (2026-11-13)

Philipo found Figure 22's chips unorganised: one flat list in code order,
severe and mild presentations mixed together. **PR #21**
(`feat/UT-002-chip-groups`, approved plan) puts them under body-area
headings, each with a line icon: fever and general, breathing, heart, stomach,
head and nerves, eyes/ears/mouth, skin and bites, muscles and joints, women's
health and urination, and a catch-all "Other". Checked in the demo PWA in
English and Cebuano: 24 chips, 8 groups, none under Other.
- **Layout only.** No tier, rule, lexicon or synced field changes. The map is
  `apps/pwa/src/chip-groups.ts`, because SYMPTOM_CODE (Table 7) has no
  category column (no amendment).
- Ordered by body area, **never by urgency**. All groups open, so no
  emergency chip is behind an extra tap. An unmapped code goes to "Other";
  empty groups are hidden. The map already covers PR #20's v2 codes.
- Icons are inline SVG in Lucide's stroke style (ISC); stomach, head and
  female are drawn by hand. No dependency added.
- **Owed:** native review of the tl/ceb headings, and clinical review of
  which group each presentation sits in (e.g. allergic reaction under skin,
  swollen legs under heart, excessive thirst under fever and general).

---

### 9r - Symptom input redesign A (PR #21) (2026-11-13)

Philipo found Figure 22 plain. Three directions were mocked up on a private
design canvas (https://claude.ai/artifact/42KrTf35NFngEhiEGyCPjD): A, a teal
header with body-area shortcuts; B, calm cards with "we recognised" words;
C, checklist rows. **He chose A**, built into PR #21 on top of the grouping:
- **Teal header band** with the title and "Nothing you write leaves this
  phone" (true: raw text never syncs, non-negotiable #8). The text box is a
  card overlapping it, with a "Cebuano, Tagalog or English" hint by the mic.
- **Shortcut tiles**, one per body-area group: buttons that scroll to the
  group and focus its heading (no `#` links, so the URL never changes). Every
  group stays open below.
- **A footer that stays in view**: "{n} selected" with the picked labels,
  Continue, the disclaimer.
- Same textbox, chips, codes and Continue; existing English copy kept; 14
  new strings (tl/ceb drafts). CSS and markup only. Build: 65.9 kB gzipped
  JS, 4.1 kB CSS. 74/74 PWA tests.
- Philipo accepted that **Figure 22's screenshot will no longer match** the
  app's look; its described function still holds, so no amendment.
- Not used from the mockups: B's hint lines and "we recognised" panel,
  C's checklist rows. Either could be added later.

---

### 9s - Emergency numbers editable in the console (PR #22) (2026-11-14)

Philipo asked that the system admin can change an emergency number when an
RHU sends an updated one. **He chose option 1**: the RHU tells the admin
outside the app, and the super-admin edits the number in the console. An
in-app request table was rejected, because it would be a schema change and
so a manuscript amendment. He also asked for a read-only portal panel.
- **Console, "Emergency numbers"**: list, add, edit, deactivate/reactivate.
  There is no delete. Saving shows the old number struck through and the new
  one in large type, with "check it digit by digit". Deactivating the last
  active number warns that "Call for help" falls back to 911.
- **Portal, "Emergency numbers"**: read-only, scoped by `BarangayScope`
  (own barangay plus city-wide, active only; UT-016). It tells RHU staff to
  send corrections to the system administrator.
- **API**: `GET/POST/PATCH /api/v1/console/facilities` (super-admin) and
  `GET /api/v1/staff/facilities`. Audit goes through the existing `Facility`
  observer, with the old number kept in `old_value`.
- **`Domain/Facility/FacilityRules`**: one dialable-number rule (digits,
  spaces, hyphens, brackets, a leading +, at least 3 digits, at most 30
  characters). `mycare:facilities:import` now refuses rows that fail it.
- No schema change. ADR-0005 amended; ut-matrix UT-016 row updated. 204/204
  Pest, console 7/7, portal 6/6.
- Phones get a change only on their next connection; both pages say so.
- **Owed:** the City Health Office CSV (still no real numbers). These pages
  are not among the manuscript's figures; they extend Figure 27's data path.

---

### 9t - Emergency numbers in the e2e smoke tests (PR #23) (2026-11-14)

PR #22 merged (`6b8e44a`); a Playwright rerun on main passed 12/12 but
never visited the new pages, because the smoke tests click a fixed list of
screens. PR #23 adds both. With no facilities in the e2e database, each
page must show its 911 fallback warning, and the portal page must offer no
Edit, Add or Deactivate button. 12/12 locally. Test files only.

---

### 9u - PRs #18 to #21 merged (2026-11-14)

Philipo asked for the remaining PRs merged so kizaru3214 can test from main.
All four were first merged together on a scratch branch and tested as one:
typecheck, every workspace's tests, Pest 205/205, Playwright 12/12.
- **#18** (unrecognised words go to the RHU fail-safe), **#19** (demo-only
  follow-up questions) and **#21** (symptom chips by body area, redesign A)
  merged as they were.
- **#20** (ruleset v2 draft) conflicted with #18 on the UT-005 row of
  `docs/ut-matrix.md`; both had rewritten it. The row now keeps both
  sentences and both sets of tests. v2 is in the code as a draft bundle
  only; nothing publishes it.
- **Two old flaky tests, not caused by these PRs:**
  - `portal.test.tsx` "names the health worker's own barangay...": the
    heading comes from the signed-in user and can render before the dashboard
    request starts, so the final `toHaveBeenCalled()` can run too early.
    Failed once in #20's CI; passed on re-run.
  - `app.test.tsx` "with no signal, keeps triaging under the new
    barangay...": the last `waitFor` (1 s default) for the stored device
    barangay can time out under heavy CPU load. About 2 failures in 20
    loaded local runs. The patient-data checks before it always passed.
  Both are test timing, not app behaviour. A follow-up can make each wait
  properly.

---

### 9v - Tagalog chip names for v1, through the console (PR #24) (2026-11-15)

On a demo test server, chips stayed English in Tagalog and Cebuano. Philipo
sent the scanned, approved v1 appraisal form and asked for Tagalog chip names
in the **real app**: Claude translates the approved Part C wording into
Tagalog; he provides the Cebuano later. The 23 English display names match the
form exactly.
- **Option A chosen:** the names go in as Tagalog **lexicon terms** in a new
  ruleset version, published from the console. The chips stay "drawn directly
  from the versioned lexicon" (Figure 22), so there is no code change in the
  real app and no amendment. Option B (a table in the PWA) was rejected.
- **The import file** is outside the repo:
  `Downloads\My_Care_ruleset_v1_tagalog_chip_names_2026-11-15.json` (v1's
  rules unchanged, plus 23 `tl` terms). It was checked on the throwaway e2e
  schema: the importer accepts it as a draft (the server picks the label),
  all 23 chips show Tagalog, and each name matches only its own symptom.
- 20 names are Kizaru's demo drafts, checked against the form. Claude fixed 3:
  - stroke signs: a drooping face, not a grimace; slurred speech, not a
    stutter;
  - headache: "red flags" restored;
  - thirst: "no altered consciousness".
  The stroke name was shortened to 96 characters for `term` VARCHAR(100).
- PR #24: demo mode uses the same three fixes.
- **Side effects of publishing it:**
  - Demo mode steps aside on that server, because a real lexicon now exists.
    Test the demo on a server without this version.
  - A chip shows the *first* Tagalog term for its code. When the reviewed
    lexicon words arrive, keep these names first.
- **Owed:** a native Tagalog speaker's check of the 23 names; Philipo's
  Cebuano.

---

### 9w - v1 chip names approved in Tagalog and Cebuano (2026-11-15)

Philipo reviewed all 23 v1 chip names in both languages and **approved all**:
- the Tagalog from 9v;
- the Cebuano exactly as in demo mode (kizaru3214's wording, now his approved
  text).

He kept the four Cebuano names flagged for wording as they were: #3 headache,
#6 muscle pain, #14 thirst, #17 stroke.
- **The import file now carries both languages:**
  `Downloads\My_Care_ruleset_v1_tagalog_cebuano_chip_names_2026-11-15.json`
  (v1's 23 rules unchanged, plus 23 `tl` and 23 `ceb` terms, longest 96
  characters). It replaces 9v's Tagalog-only file, which was deleted.
- Checked on the throwaway e2e schema: the importer accepts it; every chip
  differs from English in both languages; each of the 46 names matches only
  its own symptom.
- Demo mode already shows the same names, so there is no code change.
- **Next:** import it on the server and publish from the console. Keep these
  names first for each symptom when the reviewed lexicon words are added.

---

### 9x - "Call for help" on the unrecognised-words result (PR #25) (2026-11-15)

Philipo found that nonsense typed into the symptom box still gets through to
a result. That is PR #18's choice (Option 2, 2026-10-25): unrecognised words
go to the RHU fail-safe, never home, because a real complaint in a dialect
the lexicon does not know must not hit a dead end. He then raised that a
patient struggling to type or spell may be affected cognitively by what they
feel, which is itself a warning sign. So **nothing blocks Continue**: input
filters and a confirmation step were rejected, since each is another hurdle
for the sickest patient.
- **Done (PR #25):** the unrecognised-words result shows the emergency
  result's "Call for help" button (hotline, then RHU, then 911). No new
  wording, so nothing new to review. The tier is unchanged. Ordinary RHU
  referrals still have no call button.
- **Still open, for a clinician or Philipo:**
  - should unrecognised text ever go to Emergency (a new rule);
  - a line about confusion, sleepiness or being unable to speak on this
    screen (medical advice, needs review);
  - whether unrecognised checks keep syncing as RHU sessions with no
    symptoms (they currently do; they inflate RHU counts but show lexicon
    gaps and how many patients could not describe a problem);
  - pointing at the chips more clearly when nothing matches.
- Voice input stays parked by the earlier no-microphone decision.

---

### 9y - Batch 2 scan received; transcription sheet for Philipo (2026-11-15)

Philipo uploaded the scanned, handwritten Batch 2 form (4 pages) and asked
for a Word sheet to type the empty parts and the unreadable handwriting
himself, before anything is integrated. **Nothing was published or changed in
the ruleset.**
- **The sheet** is outside the repo:
  `Downloads\My_Care_Batch2_Transcription_Sheet_2026-11-15.docx` (landscape,
  Parts A to E). Grey cells are Claude's reading of the scan, yellow cells
  are the unclear ones, white cells are for Philipo. It carries no reviewer
  name (field-study respondent data).
- **Empty on the scan:** Part B's word column for all nine emergency rows
  (Philipo translates the vocabulary himself); Part C's emergency-answer
  column except animal bite; the Part D "Other" rows; and the Part E
  "dangerously misread" answer line, which the scan ends before.
- **Unclear, flagged in the sheet:** the date and facility in Part A;
  seizure's Part B mark; Part C's wound question; heartburn's tier box;
  burns' include box; insect sting or snake bite, where RHU and E both look
  ticked; one word in heartburn's comment.
- **Claude's reading of the 25 Part D tiers matches the v2 draft** (26 codes:
  sting and snake bite split). Both are the same reader on the same scan, so
  Philipo checks each against the paper.
- **Handwritten comments that look like new rules, for Philipo to confirm:**
  - escalations: constipation (abdominal distension), ear pain (tinnitus and
    hearing loss), dizziness (rule out cardiac);
  - a persistence condition for nausea or vomiting, and "if pain persists
    more than 24 hours" for ordinary stomach pain;
  - a note on high fever with stiff neck: "add in your app for infection
    precaution".
- **Part C's suggested questions are not tappable questions.** The app needs
  2 to 6 fixed answer choices (numbers for days or weeks), so the sheet asks
  Philipo to type the questions and choices.
- **Part E, statement 2 was rated 2 (disagree):** residents cannot always
  describe these complaints in a few typed words. That supports PR #25's
  call button on the unrecognised-words result.
- **Next:** Philipo uploads the finished sheet; Claude then proposes how it
  becomes v2 (rules, follow-ups, terms) and waits for a go-ahead.

---

### 9z - Transcription sheet checked; phrase approval sheet drafted (2026-11-15)

Philipo checked the Batch 2 transcription sheet (9y): most readings were
correct. What he typed, and what follows:
- **Part C, wound question:** "Include presence of pain, describe the wound (if
  big or deep cut)". Replaces the unclear reading.
- **Insect sting or snake bite: the nurse ticked Emergency.** The v2 draft has
  `insect_sting` as RHU and `snake_bite` as Emergency (Philipo's earlier
  split, 9p). **Open decision for Philipo:** keep the split, or set both to
  Emergency as the form reads.
- Part A facility and date were typed in the sheet. They identify the
  respondent, so they are not recorded here.
- Yellow readings he did not change are taken as correct: heartburn tier,
  burns include box, seizure mark.
- **Part B words:** the appraiser could not supply them, because patients
  phrase things in many ways, and asked for **Claude to draft candidates for a
  reviewer to approve or reject.** This is a second, narrower exception to
  "never invent lexicon terms" (see memory). Claude drafted **272 phrases** for
  the nine emergency presentations in English, Tagalog and Cebuano: 8 positive
  phrases per language per presentation, 2 negations, plus Philipo's two
  English phrases for difficulty breathing. 27 are marked **broad** (a milder
  problem could say them, so approving sends that patient to Emergency).
  Everything is in `Downloads\My_Care_Batch2_Phrase_Approval_Sheet_2026-11-15.docx`
  with Approve / Reject boxes. Nothing is in the repo or any ruleset.
- **Checked by computer:** with the real matcher, all 218 positive phrases
  match only their own presentation and all 54 negations negate only their
  own. No phrase repeats another in its language, and the longest is 55
  characters (limit 100). The check caught one defect: the Cebuano negation
  "klaro akong pagsulti" sat inside the positive "dili klaro akong pagsulti" and
  would have cancelled it. It was replaced, and a second check now looks for
  any negation inside a positive phrase.
- **Not yet reviewed by anyone.** The Tagalog and Cebuano are AI-written and
  need a native speaker; Carcar Cebuano may differ.
- **Next:** the approved sheet comes back, then Claude proposes the import
  (the 49-rule v2 with approved terms, plus the follow-up questions) and waits
  for a go-ahead. Phrases for the other presentations are a separate
  decision.

---

### 9aa - Phrase approval sheet came back (2026-11-15)

Philipo returned the phrase approval sheet (9z): **no row is marked Reject, and
he said the rows left blank are approved**, so all 272 drafted phrases are
approved, including the 27 marked broad. He typed **9 corrections, all
Cebuano**. They read as additions to the approved phrases; where the wording
did not say "add", Claude treated them the same way (to be confirmed).
- **12 distinct added phrases**, none yet in any file:
  - chest pain: "sakit ako dughan", "sakit akong dughan", negations
    "way sakit ako dughan" and "way sakit akong dughan";
  - severe stomach pain: "sakit ako tiyan", "sakit akong tiyan", "gahi akong
    tiyan", "nangahi akong tiyan", "gahi kaayu akong tiyan", "grabe sakita sa
    ako tiyan";
  - allergic swelling: "nihubag akong nawng", "nanghubag ug gi hikap ako nawng".
- **Matcher test of the additions** (against all 272 plus the 12): no
  duplicates, and the negations still negate. Two problems, so five of the
  twelve are **held for Philipo's decision**:
  - **Too broad.** "sakit akong tiyan" (my stomach hurts) now resolves to
    severe abdominal pain, which is Emergency, so a Cebuano stomach ache of
    any size is Emergency, and the v2 row "ordinary stomach pain" (Home) can
    never be reached with those words. Likewise "sakit akong dughan"
    resolves to severe chest pain. Held: "sakit ako/akong tiyan" and
    "sakit ako/akong dughan".
  - **Misplaced.** "grabe sakita sa ako tiyan" (stomach) sits under the chest
    pain row (B2-ceb-01), and again under B4. It would also repeat the same
    term twice in one version, which the database rejects. Probably meant
    "grabe sakit sa ako dughan" there. "sakita" may be a typo for "sakit".
- Minor: "gahi kaayu akong tiyan" has no negation partner, so "dili gahi kaayu
  akong tiyan" (not very hard) comes back as present. That errs toward
  escalation.
- **Plan proposed, not started:** a new import file for **v1** (the nine
  emergency presentations are all in v1, so v2 need not wait): v1's rules, the
  46 approved chip names first, the nine English display names first among
  the English terms (otherwise English chips would change to the first phrase),
  then the approved phrases. It replaces
  `My_Care_ruleset_v1_tagalog_cebuano_chip_names_2026-11-15.json` and goes in
  as a draft.

---

### 9ab - v1 import file with the approved phrases (2026-11-15)

Philipo answered the two held items from 9aa:
- **The misplaced phrase: "correct it".** B2-ceb-01's stomach phrase is now the
  chest phrase "grabe sakit sa ako dughan" (Claude's guess, accepted). The
  stomach phrase stays once, under B4, spelled "grabe sakit sa ako tiyan"
  ("sakita" read as a typo).
- **The short plain phrases: "keep the 'kaayu', but make a follow-up with the
  negation if it's severe or not".** Read as: phrases with "kaayo/kaayu"
  stay as the severe presentation, and plain "sakit akong tiyan / dughan"
  should ask a follow-up question (is it severe?) instead of going straight
  to Emergency. **Claude has not built that.** It is a new rule and a new
  clarification question, so it waits for Philipo to confirm the reading and
  the "No" branch (see the message that followed).
- **The file:** `Downloads\My_Care_ruleset_v1_with_approved_phrases_2026-11-15.json`.
  335 terms on v1's 23 rules (rules unchanged): the 46 approved chip names
  first, the nine English display names first among the English terms (so
  English chips are unchanged), then the approved phrases and Philipo's
  additions: English 83 + 18 negations, Tagalog 94 + 18, Cebuano 102 + 20.
  One drafted Tagalog phrase equalled an approved chip name for the same
  symptom and was skipped as a duplicate.
- **Held out of the file:** "sakit ako/akong tiyan" and "sakit ako/akong
  dughan". With them out, those phrases match nothing, so a plain "sakit akong
  tiyan" gets the RHU fail-safe with the call button (PR #25).
- **Checks:** the real importer accepts it on the throwaway schema (335
  stored, 23 rules); tl and ceb chips identical to the approved chip names;
  English chips unchanged; all 279 positives match only their own symptom;
  all 56 negations negate only their own symptom.
- It supersedes `..._tagalog_cebuano_chip_names_...json` (kept, not deleted;
  that one is already published in Philipo's local database). Not imported
  anywhere new.

---

### 9ac - Console import failed with "Unexpected token '<'" (2026-11-15)

Philipo tried **Import bundle JSON** in the console and got `Unexpected token
'<', "<br /> <b>"... is not valid JSON`. It was not the file.
- **The file is fine.** Posted over real HTTP to a spare-port API on the
  throwaway e2e database: 201 in 1.2 s. Run on the dev database inside a
  rolled-back transaction: accepted in 0.7 s. Nothing was saved anywhere.
  Bad bundles (not a bundle, an unknown symptom code, no body) come back as
  clean JSON 422s.
- **The cause is the dev API process on port 8000.** It had been running since
  13 Nov (started from a VS Code PowerShell terminal). On every POST it prints
  `Warning: PHP Request Startup: Unable to create temporary file, Check
  permissions in temporary files directory` and `POST data can't be buffered;
  all data discarded`, even for a 50 KB body. PHP echoes that HTML before
  Laravel can reply, so the log shows `422 ... headers already sent` (the empty
  body failed validation) and the browser gets HTML where it expects JSON.
  A fresh PHP process on the same machine creates temp files normally (the temp
  folder holds 178 files and has 308 GB free). A throwaway server started with
  a nonexistent TEMP reproduces the exact symptom, so that process inherited
  a bad temp setting.
- **Fix:** restart the API from a terminal with a normal TEMP:
  `php -d variables_order=EGPCS artisan serve --no-reload --port=8000`.
- **Deployments:** the same symptom on a real server means PHP's temp
  directory is not writable by the web user (`www-data` for PHP-FPM).
  Large posts, including this import and device syncs, would fail with it.

---

### 9ad - Delete a draft in the console (PR #26) (2026-11-15)

Philipo asked for a delete button on drafts in Triage rules & lexicon, because
the list looked messy. Every save and import adds a draft, and a mistaken
"New draft" click could not be undone. He chose a real delete over hiding or
"discarding", for drafts that are not published, unfinished, or created by
mistake.
- **Only `draft` can be deleted.** In review must be returned to draft first.
  Saved-over (`superseded`), published and retired versions are never
  deleted: UT-010 says prior versions remain retrievable. Superseded and
  retired versions sit behind "Show older versions (n)" so the list is
  readable without losing history.
- **ADR-0006 amended** (our document, not the manuscript): "nothing is ever
  deleted" became "nothing that went to review or was published is ever
  deleted". No schema change, no manuscript amendment.
- **Audit:** `draft_deleted` records who, when, the label, the version it was
  based on, and how many of each thing it held. The content itself goes with
  the version (the cascade is not audited row by row). A draft is never
  served to a device and no session points at one; the foreign key is the
  backstop.
- **Labels are reserved.** `VersionWriter::nextLabel` counts labels in
  `draft_deleted` entries, so a deleted v3 is never reused. Checked in a
  browser: after deleting v3, the next new draft was v4.
- **Tests:** Pest 210/210 (5 new; the label test fails when the reservation
  is disabled), console 11/11 (4 new), Playwright 12/12.
- **Caveat found:** the PHP Pint style fixers already flag
  `RulesetLifecycle.php` and the controller on main. CI does not run Pint;
  left alone.
- **Not touched:** Philipo's own dev drafts (the browser check used the
  throwaway e2e database).

---

### 9ae - "Is the pain severe?" follow-ups, v2 (PR #27) (2026-11-15)

Philipo answered 9ab's open question: a plain "sakit akong tiyan / dughan"
asks "is it severe?", and **"No, not severe" leads to Home with a health
tip.** Claude proposed four defaults and he accepted them with "go": chest
"No" goes to **RHU, not Home**; the tip is limited to the appraiser's own
wording; the English and Tagalog plain phrases get drafted for approval; the
question wording is as below.
- **Mechanism: nothing new in the engine.** A question's `redFlagAnswer` goes
  to Emergency (ADR-0001 step 1). In v2: `abdominal_pain_ordinary` and a new
  `chest_pain_unspecified` (R-050, "Chest pain (any kind)") ask "Is the
  stomach / chest pain severe?" (en, tl "Matindi ba…?", ceb "Grabe ba…?";
  answers No/Yes, Hindi/Oo, Dili/Oo). Yes is Emergency. No: stomach Home (the
  appraiser's own tier) and chest RHU. The app has no way to skip a question.
- **Why chest "No" is RHU, not Home (open for the appraiser):** a patient with
  a heart problem may well answer "No", and the form marks chest tightness
  Emergency. The appraiser has never ruled on chest pain "not severe".
  Philipo can still choose Home.
- **The tip** (stomach, Home only) says only what the appraiser wrote: pain
  over 24 hours, or no relief from medication, go to the RHU. tl and ceb are
  unreviewed drafts. Other home advice must come from the appraiser. No chest
  tip.
- **Repo (PR #27):** `v2.ts`, tests, `ut-matrix.md`. The form's 26 stay as
  appraised; v2 is now 50 presentations. v1, the engine and the schema are
  untouched.
- **Import file:** `Downloads\My_Care_ruleset_v2_with_approved_content_2026-11-15.json`
  (339 terms, 50 rules, 6 question rows, 3 tips). It holds the 46 approved chip
  names, the approved emergency phrases and the nurse's four plain Cebuano
  phrases, now under the two follow-up symptoms. The importer accepts it on the
  throwaway schema. It supersedes the v1 phrases file. Not imported anywhere.
  The 26 new v2 symptoms still have no tl or ceb chip names (their wording and
  Cebuano are not yet confirmed).
- **Sheet:** `Downloads\My_Care_Plain_Stomach_Chest_Phrase_Sheet_2026-11-15.docx`,
  46 drafted phrases: plain stomach and chest pain in English, Tagalog and a
  few more Cebuano, plus "no stomach pain" negations. Until it is approved, the
  English and Tagalog plain phrases match nothing (RHU fail-safe with the call
  button), and "walay sakit akong tiyan" is read as stomach pain.
- **Checks:** every approved and new positive (317) matches only its own
  symptom; 64 negations negate only their own; severe wording still goes
  straight to Emergency.
- **Two weak spots found, not fixed:**
  - Any text containing a recognised phrase counts as understood, so a second
    complaint is missed: "sakit akong tiyan ug dughan" matches only the
    stomach, so the chest part is lost and the answer can end at Home. Before
    this change it matched nothing and got RHU.
  - Phrases approved earlier as "broad" and meaning the same as a plain phrase
    still go straight to Emergency without asking: chest "my chest hurts so
    much", "chest pain that won't go away", "kumikirot ang dibdib ko",
    "nagsakit ang akong dughan"; stomach "sobrang sakit ng sikmura ko",
    "lumalala ang sakit ng tiyan ko", "nagkagrabe ang sakit sa akong tiyan".

---

### 9af - Some chips still English in Cebuano (2026-11-15)

Philipo published v8 locally (50 rules, 339 terms, both follow-up questions) and
noticed chips still in English in Cebuano. Cause, checked with the app's own
`chipsFor` on the published content:
- **25 chips are English in Cebuano and 27 in Tagalog.** They are the new v2
  symptoms (the form's 26 plus chest pain). Only v1's 23 have approved tl and
  ceb chip names (9v/9w). v2's 26 never got any: the English wording and
  Philipo's Cebuano were pending.
- **The two follow-up symptoms show odd Cebuano chips.** A chip shows the
  *first* term in the language, and the only Cebuano terms for
  `abdominal_pain_ordinary` and `chest_pain_unspecified` are the nurse's
  plain phrases, so their chips read "sakit ako tiyan" and "sakit ako dughan".
  Proper chip names listed first fix this; Claude did not invent Cebuano ones.
- **Sheet:** `Downloads\My_Care_Chip_Names_v2_Sheet_2026-11-15.docx`, 27 rows:
  the form's English wording, Claude's Tagalog translation (grey) with a tick
  or change box, and a blank Cebuano column for Philipo. Claude treated the
  Part D complaint names as confirmed (Philipo checked the transcription sheet).
  Yellow: insect sting and snake bite (one form row, split) and chest pain
  (any kind), which is not on the form.
- **Next:** the sheet comes back, then Claude regenerates the v2 import file
  with the chip names first (then the approved phrases), and checks every
  chip is non-English in tl and ceb.
- **Related, found the same day:** a device re-downloads the rules only when its
  copy is over 6 hours old, or when setup completes (first onboarding, change
  of barangay), so a new publish can take up to 6 hours to reach a phone that
  already has a copy. Offered: a quiet check on launch and a "Check for new
  rules" button. Not built; a sync-layer change awaiting Philipo's go-ahead.

---

### 9ag - Cebuano chip names drafted for Philipo to check (2026-11-15)

Philipo asked Claude to **generate the Cebuano chip names** for the 27 new v2
symptoms and said they would check them "like before" (the phrase approval
pattern, 9z/9aa). So Claude, not Philipo, wrote the Cebuano this time.
- **Sheet:** `Downloads\My_Care_Chip_Names_v2_Sheet_with_Cebuano_draft_2026-11-15.docx`
  (the earlier copy without Cebuano was open in Word and was left alone).
  Per row: the form's English, Claude's Tagalog and Cebuano drafts (grey), and
  "fine / change to" boxes for each. Yellow Cebuano cells name the words
  Claude is least sure of: constipation, heartburn, tingling, "lutahan"
  (joint) and "paak o tusok" (insect sting). The Cebuano reuses the style of
  the approved v1 chip names ("samad", "hubag", "sakit sa").
- **Checked before handing over, with the real matcher:** every name is under
  100 characters; no name repeats another term under a different symptom;
  all 337 positive terms (approved plus the 54 new chip names) still match only
  their own symptom; the 56 negations still negate only their own; and with
  these names first, **0 of 50 chips are English** in tl or ceb. The two follow-up
  symptoms get proper chip names instead of "sakit ako tiyan / dughan".
- **A consequence to weigh:** chip names are also lexicon terms, so typing
  "sakit sa likod" or "sakit ng likod" is now read as back pain (Home).
  Intended, but each name is therefore also a recognition phrase.
- **Not reviewed by anyone.** Both languages are AI-written. Carcar Cebuano may
  differ. The memory note on drafting lexicon content now covers this too.
- **Next:** the checked sheet comes back; Claude regenerates the v2 import file
  with the approved chip names first, then the approved phrases.

---

### 9ah - Chip names approved; v2 import file with them (2026-11-15)

Philipo said "all good" to the chip names sheet (9ag). The sheet on disk has
no ticks or edits, so this is his approval in chat of **all 27 Tagalog and
all 27 Cebuano drafts as written**, including the Cebuano words Claude had
flagged as least sure of (constipation, heartburn, tingling, "lutahan",
"paak o tusok"). Both languages remain AI-written; no native speaker has
reviewed them beyond Philipo.
- **New import file:** `Downloads\My_Care_ruleset_v2_with_chip_names_2026-11-15.json`.
  393 terms: the 46 approved v1 chip names, the 54 new chip names (27 tl + 27
  ceb) listed right after them, then the 293 approved phrases. Plus v2's 50
  rules, 6 question rows and 3 tips. It supersedes
  `..._v2_with_approved_content_...json` (kept, not deleted).
- **Checks:** the real importer accepts it on the throwaway schema (393 terms:
  en 101, tl 139, ceb 153); **0 of 50 chips are English in Tagalog or Cebuano**;
  the English chips still equal the form's wording; all 337 positive terms match
  only their own symptom and the 56 negations negate only their own; the app flow
  still gives stomach "Dili" = Home plus the tip, "Oo" = Emergency, chest "Dili" =
  RHU, and "kaayo" goes straight to Emergency.
- **Still pending:** the plain stomach and chest phrase sheet (so the English
  and Tagalog plain phrases still match nothing), the appraiser's ruling on
  chest "No", and the stomach tip's wording.
- **To use it:** import as a draft, submit for review, publish with the
  clinical-review confirmation, then force the device to re-download (change
  barangay or clear site data), since a device only refreshes after 6 hours.

---

### 9ai - Plain phrases approved; the final v2 import file (2026-11-16)

Philipo confirmed v10 on his device (every chip Cebuano, the question works),
then returned the plain stomach and chest phrase sheet (9ae) with "all
approve". The sheet on disk has no ticks or edits, so this is his approval in
chat of **all 46 rows, including the 8 stomach "cancels it" negations**, which
Claude had asked him to tick explicitly.
- **Final file:** `Downloads\My_Care_ruleset_v2_final_2026-11-16.json`. 437 terms:
  the 100 approved chip names (v1 and the 27 new, tl and ceb), then English
  display names, then every approved phrase: English 99 + 20 negations,
  Tagalog 135 + 20, Cebuano 139 + 24. Plus 50 rules, 6 question rows, 3 tips.
  It supersedes the chip-names file (kept; that one is published locally as
  v10).
- **A defect caught before handing over:** the two follow-up symptoms now have
  English phrases, and a chip shows the first term in its language, so their
  English chips would have read "my stomach hurts". Their English display names
  now come first. Same fix as for the nine emergency symptoms in 9ab.
- **Checks:** the real importer accepts the file on the throwaway schema; all 373
  positive terms match only their own symptom and the 64 negations negate only
  their own; 0 of 50 chips are English in tl or ceb; the English chips equal the
  form's wording; and the app flow works in all three languages (stomach "No"
  = Home plus the tip, "Yes" = Emergency; chest "No" = RHU, "Yes" = Emergency;
  "no stomach pain" in en, tl and ceb is understood and checks nothing).
- **Still open:** the appraiser's ruling on chest "No"; the stomach tip's
  wording; "Check for new rules" (not built); the insect sting / snake bite tier
  (the form ticked Emergency, the draft has insect_sting at RHU); Part C's
  follow-up questions.

---

### 9aj - Step 3 answered: chest "No" is RHU, stomach "No" is Home with the tip (2026-11-16)

Philipo answered the two questions meant for the nurse:
1. **Chest pain, "No" to "Is the chest pain severe?": RHU.** This is what is
   built, so nothing changes.
2. **Stomach pain, "No": Home, with the health tip.** Also as built. Read as:
   the tip keeps only the appraiser's own wording and nothing else is added.
- **Who confirmed:** Philipo, in chat. The nurse's own ruling on chest pain
  "not severe" is **not on record**; it is still worth telling the nurse before
  any real use.
- **Not yet approved:** the Tagalog and Cebuano wording of the tip. They are
  Claude's drafts of the English (see v2.ts), shown to Philipo for approval next.
- No code, file or schema change. `My_Care_ruleset_v2_final_2026-11-16.json` is
  unchanged and still unpublished.

---

### 9ak - Chest "No" is Home; remedy tips drafted for the nurse (PR #28) (2026-11-16)

Philipo **disregarded his previous answers** (9aj) and decided:
1. **Chest pain "No" goes to Home, with the health tip** (it was built as RHU).
2. **Claude provides the basic remedy for the pain, and the nurse reviews it.**
This reverses the RHU default Claude had proposed. Claude had warned that a
patient with a heart problem may well answer "No"; the choice is Philipo's.
- **Built (PR #27 follow-up, PR #28):** `chest_pain_unspecified` R-050 is
  now home. Three home tips each for stomach and chest pain in en, tl and ceb
  (18 rows): what can help; get help right away if; if the pain does not go
  away. The stomach "does not go away" tip is the appraiser's own wording,
  unchanged. **The rest is medical content written by Claude and not
  reviewed by any clinician.** No medicine is named and no dose given (a test
  enforces it). The chest list opens with the warning signs, as the
  mitigation for chest "No" being Home.
- **Review sheet for the nurse:** `Downloads\My_Care_Health_Tips_Review_Sheet_2026-11-16.docx`.
  The English tips with Approve / Reject / Change, the tl and ceb drafts for
  Philipo, and a box for the nurse's ruling on chest "No": Home, RHU or
  Emergency. Nothing is used until it comes back.
- **Import file:** `Downloads\My_Care_ruleset_v2_final_with_tips_2026-11-16.json`
  (437 terms, 50 rules, 6 questions, 18 tips). It supersedes
  `..._v2_final_2026-11-16.json`. The importer accepts it on the throwaway
  schema. Not imported or published. Philipo's local v10 still has the RHU
  chest rule and one stomach tip.
- **Checks:** ruleset 7/7, engine 17/17, Pest 210/210; in all three languages
  stomach and chest "No" give Home with three tips, and "Yes" gives Emergency;
  373 positive terms and 64 negations unchanged; no English chips.
- **Open:** the nurse's ruling on chest "No" and sign-off on the tips; the
  insect sting / snake bite tier; "Check for new rules"; Part C questions.

---

### 9al - The nurse approved the tips; chest "No" is Home (2026-11-16)

Philipo reported that the nurse reviewed the health tips review sheet (9ak):
**all six tips approved, and Home ticked for chest pain "No".**
- **Who confirmed:** Philipo, in chat, on the nurse's behalf. The copy of the
  sheet on disk (`Downloads\My_Care_Health_Tips_Review_Sheet_2026-11-16.docx`) has no
  ticks, no changes, no reviewer name and no date, so there is **no signed or
  ticked record yet**. Worth keeping one (a photo or the ticked copy) for the
  appendix.
- **Taken as approved:** the English tips, and the Tagalog and Cebuano drafts
  beside them, as written. No rewrite was requested, so
  `My_Care_ruleset_v2_final_with_tips_2026-11-16.json` is final as built.
- **Chest pain "No" is Home** with the three tips, with the nurse's agreement.
  This settles the question Claude raised in 9ae and the RHU default of 9aj.
- **PR #28** (the code behind this) passes all five CI checks and is waiting for
  Philipo to merge it. Nothing is published yet; his local v10 still has the RHU
  chest rule and one stomach tip.
- **Next:** merge PR #28; import the final file as a draft; publish with the
  clinical-review confirmation; force the device to refresh.

---

### 9am - Insect sting is RHU, snake bite is Emergency (2026-11-16)

Philipo clarified the Batch 2 Part D row "insect sting or snake bite" (9p, 9z):
the nurse's form already approves **insect sting → RHU and snake bite →
Emergency**. The two ticks on the one row are one tier per animal, not
Emergency for both.
- **Who confirmed:** Philipo, in chat, reading the nurse's form.
- **No code change:** `packages/ruleset/src/bundle/v2.ts` already has
  `insect_sting` at `rhu` and `snake_bite` at `emergency`, and the final import
  file was built from it.
- **Closes** the open decision in 9z and the "insect sting / snake bite tier"
  item carried in 9aj and 9ak.
- **PR #28** has since been merged (`df693e5`), so 9al's "waiting for Philipo
  to merge it" is out of date.
- **Still open:** "Check for new rules"; Part C questions; body-area
  groups; zero suppression.
- **Also settled (same day):** unrecognised words stay **RHU with the
  emergency call button** (PR #25, 9x). Philipo confirmed this is the final
  rule, so the open question of sending them to Emergency, or adding a "get
  help now" line, is closed. Checklist 3 / 39.

---

### 9an - Part C follow-up questions drafted for the nurse (2026-11-16)

The Batch 2 Part C wording was mostly illegible (9x), so at Philipo's request
Claude drafted the follow-ups for the nurse to review, as with the tips (9ak).
**Medical content, not clinically reviewed. Nothing is in the code or the app.**
- **Sheet:** `Downloads\My_Care_Follow_Up_Questions_Review_Sheet_2026-11-16.docx`.
  English for the nurse; Tagalog and Cebuano are Claude's drafts for Philipo.
- **Seven questions**, each attached to a v1 code, with a result per answer:
  1. fever days (`fever_mild`): 1-2 days Home, 3+ RHU;
  2. cough length (`cold_cough_no_sob`): under 2 weeks Home, 2+ RHU;
  3. dehydration signs (`diarrhea_mild_no_dehydration`): Home / RHU / Emergency;
  4. wound size (`minor_wound_no_infection`): Home / RHU / Emergency (bleeding
     that will not stop);
  5. wound infection signs (same code): No Home, Yes RHU;
  6. headache danger signs (`headache_mild_moderate`): Home / RHU (3+ days,
     Claude's suggestion) / Emergency;
  7. pads soaked (`spotting_first_trimester_mild`): RHU / RHU / Emergency (1+
     pad an hour).
- **Animal bite:** no question. The form says "consult immediately", so the
  draft keeps R-013 at RHU and adds an RHU tip (wash 15 minutes, go today).
- **Built to fit the engine:** answers are fixed choices; at most one Emergency
  answer per question (`redFlagAnswer`, 50 characters max in every language,
  checked); RHU answers will need attribute conditions on new rules. A question
  can only keep or raise a tier: the base rule still matches.
- **Flagged for the nurse:** exactly 3 days of fever (v1 says under 3 and over
  3); the spotting middle answer; a second diarrhea duration question; cough
  with blood or weight loss.
- **Next:** the nurse reviews; Philipo checks the Tagalog and Cebuano; then
  Claude proposes the code change (questions, `needsClarification`, new rules,
  tests) and waits for a go-ahead.

---

### 9ao - Nurse approved the Part C follow-up questions (2026-11-16)

The review sheet from 9an came back with **"approve" on all 8 rows**: the seven
questions, their answers and results, and the animal-bite tip.
- **Who approved:** the nurse (the Batch 2 appraiser), as Philipo confirmed in
  chat. The approval **covers the English, Tagalog and Cebuano** wording, so the
  tl and ceb text is no longer only Claude's draft.
- **Reviewer name and date on the sheet were left blank.** The nurse is not
  named in the repo either way.
- **The yellow questions were left unanswered.** Philipo's reading is "keep as
  drafted", so:
  - exactly 3 days of fever goes to RHU;
  - there is no second diarrhea duration question;
  - the cough question does not also ask about blood or weight loss;
  - the headache middle answer (3 days or more: RHU) stays;
  - the spotting middle answer (1 pad or more a day, under 1 an hour) stays RHU,
    and severe belly pain is not asked.
- **The tip titles** keep no trailing colon in Tagalog and Cebuano. The colon
  on the sheet was layout only, and the English title has none.
- **Philipo gave the go-ahead** for the code change proposed in chat. The
  change is described in 9ap.

---

### 9ap - Part C follow-ups encoded in v2: PR #29 (2026-11-16)

The approved follow-ups (9ao) are in `packages/ruleset/src/bundle/v2.ts` on
`feat/UT-005-followup-questions`, **PR #29, merged 2026-11-16 (`46b782c`)**, branch kept.
**Medical content from one appraiser: still a draft for clinical review.**
- **Content:**
  - 7 questions × 3 languages (21 rows) on six v1 codes, each code now asking
    first;
  - RHU rules R-051 to R-056, each "<question> != <home answer>";
  - the animal-bite RHU tip × 3. R-013 stays RHU.
- **Engine:** `=` and `!=` now compare exact text when either side is not a
  number; numbers compare as before. Text used to become `NaN`, so `!=` was
  always true. Still pure (ADR-0001 amended).
- **Three gaps found while building it, each settled by Philipo in chat:**
  1. **The server served Cebuano first.** `BundleAssembler` sorted by
     language, and the phone submits and the server stores the first
     variant's answer. So the 63-character Cebuano spotting answer would have
     failed sync (VARCHAR(50)), and the RHU rules would have fired on every
     answer. Now English first. Philipo chose this over comparing by answer
     position.
  2. **Answers were capped at 50 characters.** Now 100, since
     `allowed_answers` is JSON. The English (submitted) answers are still held
     to 50.
  3. **The importer refused to change a code's follow-up flag.** A frozen code
     may now switch it from off to on, audited. It can never go back to off,
     and the switch is refused if a frozen version already has questions for
     that code (ADR-0006 amended).
- **Also fixed:** the "no medicine in tips" test guard held backspace bytes
  instead of `\b`, so it never matched `mg`, `tablet` or `pill`.
- **Tests:** all JS workspaces, purity, and 218/218 Pest on MySQL.
- **Import file:** `Downloads\My_Care_ruleset_v2_final_with_followups_2026-11-16.json`,
  which is the export plus the same 437 lexicon terms. It **replaces**
  `..._with_tips_...`. Import it after the merge, then publish and force a
  device refresh.
- **Unanswered follow-up = base tier** (Home for five codes), the same as the
  stomach and chest questions. Philipo did not ask for skipping to give RHU.

---

### 9aq - "gi ubo ko" added for cough, draft v14 (2026-11-16)

Philipo asked for the Cebuano phrase **"gi ubo ko"** ("I have a cough"). It is
his own word, not one Claude drafted.
- **Code:** `cold_cough_no_sob` (Home). The phrase gives no duration, so the
  `cough_weeks` follow-up decides: 2 weeks or more goes to RHU. It is not
  mapped to `cough_persistent`, which is RHU.
- **Where:** added in the console to draft v13 and saved as **draft v14**, with
  438 terms. Nothing is published yet. v14 replaces v13 as the version to
  submit and publish.
- **Matcher check before adding:**
  - "gi ubo ko", "Gi-ubo ko", "giubo ko" and "gi ubo ko og 3 ka adlaw" all
    match;
  - "nag ubo ko" and "gi ubo" alone do not;
  - "ubos sa 3 ka adlaw" ("under 3 days") does not misfire.
  Before the term, "gi ubo ko" matched nothing and fell to the RHU fail-safe.
  Test & explain on v14 shows it matching `cold_cough_no_sob`, R-002.
- **Not added:** a Cebuano negation such as "dili ko gi ubo". Today that
  phrase matches nothing. If one is wanted, the word must come from Philipo.

---

### 9ar - Console: follow-up dropdowns and "Reviewed and approved by" (2026-11-17)

Philipo merged two console PRs. Both branches are kept.
- **PR #30 (`84dde9e`), UT-007.** Test & explain asked for each follow-up
  answer as free text. With the Part C "!=" rules, a typo or a half-typed
  answer showed RHU, and a Tagalog or Cebuano answer never matched. Each
  follow-up is now a dropdown: "Not answered", then the English answers with
  the tl and ceb wording beside them, and the red flag marked. A choice sends
  exactly what the phone sends. Checked by hand on draft v13: fever "3 days or
  more" gives RHU (R-051), and wound "Bleeding that will not stop" gives
  Emergency.
- **PR #31 (`e316b01`), UT-011.** Publishing now requires "Reviewed and
  approved by (name or role)", up to 100 characters. The console shows
  "Reviewed and approved by: ..." on the version page and in the version list.
  Philipo's decisions:
  - **console only**: phones never receive it;
  - **audit log, no schema change**: one `clinical_review` entry written by
    `RulesetLifecycle` through `Recorder`, never edited, and copied onto a
    rolled-back version with `carried_from` (ADR-0006 amended);
  - **a name only with consent, otherwise a role**: the first appraiser did
    not consent to be named, so a role such as "RHU nurse, Carcar" is what to
    enter for her.
  v11 and older show "not recorded".
- **Version numbers (asked, no change).** Labels stay v1, v2, and so on:
  - a deleted draft's number is never reused, so the audit log never has two
    different v13s;
  - every save makes a whole new version;
  - dotted labels such as v14.0.1 were declined, because even one word
    (9aq) can move a patient between tiers, so no change is "minor".
- **Flaky e2e test:** `patient.change-barangay.spec.ts` ("Brgy. Valladolid"
  not visible) fails now and then with no related change. It failed on the
  docs-only commit 5027f5a and on PR #31's first run, then passed on a rerun.
  It has been failing intermittently since PR #28. When it fails, the staff and
  lexicon e2e projects never run. Not fixed yet.
- **Next for Philipo:**
  1. `git checkout main && git pull`;
  2. submit v14 for review;
  3. publish it with the reviewer field filled in;
  4. force a device refresh and run the device tests (9ap, 9aq).

---

### 9as - UAT on the live server; nine "not" phrases approved; pilot sheet (2026-11-17)

Philipo deployed to mycare.pogorot.com and asked for the UAT form to be run
against it. Form A (patient) was run in Cebuano, barangay Valladolid. Forms
B and C wait for him to sign in.
- **Live content:** published v5 is exactly
  `My_Care_ruleset_v2_final_with_tips_2026-11-16.json` (fingerprints of
  symptom codes, terms, rules, questions, tips and thresholds all match).
- **Form A:** 12 of 15 steps pass, 2 pass with a problem, 1 partly fails. The
  offline steps were simulated in the page, so they need one check on a real
  phone.
  - **The server runs code from before PR #25**: the "not recognised" result has
    no Call for help button. So #26 to #29 are probably missing too. Redeploy
    from `main` before importing anything with the Part C questions.
  - **No emergency numbers on the server:** Call for help dials 911.
  - The upload reused its batch uuid on retry and was stored once. It carried
    codes and lexicon entries, never the typed sentence.
- **Negation is word for word only, by design** (`match.ts`): "dili sakit
  ang akong tiyan" read as stomach pain *present*, because the plain phrase
  inside it matched. A code change (negation cues derived from the approved
  lexicon) was proposed and not taken. Philipo chose to add phrases instead.
- **Nine Cebuano negations, drafted by Claude, approved by Philipo
  2026-11-17:** for `abdominal_pain_ordinary`, "dili sakit ang akong tiyan",
  "dili sakit ako tiyan", "walay sakit ang akong tiyan", "walay sakit sa
  tiyan", "wala koy sakit sa tiyan" and "wala nagsakit akong tiyan"; for
  `fever_mild` (as in the test fixture), "walay hilanat", "wala koy hilanat"
  and "wala ko gihilantan".
  - **Checks:** each gives x for its own code, alone and beside "ginahangos
    ko"; no existing term's match changes; "naay hilanat" is still never read
    as a negation. The real importer stores both files on `mycare_test`, which
    was reset to empty afterwards.
  - **Files** (nothing imported anywhere else):
    - `Downloads\My_Care_ruleset_v5_plus_not_phrases_2026-11-17.json`
      (446 terms): for the live server now;
    - `Downloads\My_Care_ruleset_v14_plus_not_phrases_2026-11-17.json`
      (447 terms, Part C and "gi ubo ko" included): replaces v14 after the
      redeploy.
- **Pilot sheet:** `Downloads\My_Care_Pilot_Cebuano_Phrases_2026-11-17.docx`.
  It holds a patient card of Cebuano phrases and a facilitator key. Every one
  of v5's 139 Cebuano terms was run through the matcher and engine.
  - **Typed phrases (89) only reach Emergency or the stomach and chest
    question.** 39 of 50 symptoms can only be tapped.
  - Valid only while v5 is published.
  - `heartburn_acid_reflux` gives Emergency (R-026): flagged for the appraiser.
- **UAT form corrected:** `Downloads\My_Care_UAT_Form_2026-11-17.docx`. Step
  10 now uses a phrase that exists, and steps 7 and 8 say "then Get started".
- **Test data on the live server:** 6 sessions in Valladolid; the test device
  is now registered to Bolinawan.
- **Next for Philipo:** import the v5 file in the live console, submit it,
  publish it with "Reviewed and approved by" filled in, and force a device
  refresh. Or redeploy first and use the v14 file.

---

### 9at - Nurse phrase review approved; 13 follow-ups encoded (PR #32) (2026-11-17)

Philipo asked for Cebuano dialect and modern Bisaya phrases, and follow-up
questions, for a nurse to review. Claude drafted
`Downloads\My_Care_Cebuano_Phrase_Review_for_Nurse_2026-11-17.docx`, with an ID key
beside it (`..._ID_key.json`).
- **The sheet:**
  - A1: 383 new phrases;
  - A2: 140 short spellings;
  - B1: notes on the 9 existing questions;
  - B2: 13 proposed danger-sign follow-ups.
  The phrases come from binisaya.com and Wikipedia's Cebuano, Boholano,
  Davao and Bislish pages. Every one was checked with the real matcher.
  - **Claude's error on the sheet:** A2's header says all 140 are short forms
    of phrases already in the app. 43 are short forms of new A1 phrases. No
    decision depends on it, because every A1 original was approved too.
- **Returned the same day, all approved:**
  - all 523 phrases ticked OK;
  - the 9 existing questions kept as they are, so the wording notes were
    declined;
  - all 13 new questions approved with no changes.
  - **Who:** a nurse went through it with Philipo, as he confirmed in chat.
    The sheet names the nurse, but consent to be named was not confirmed, so
    the repo and console record "nurse" (9ar rule).
  - **Scope:** the signature line reads "will vouch for the pilot testing".
  - **Questions on the sheet that were ticked without an answer, so stay as
    drafted:**
    - haemorrhoids "gi-almoranas ko" goes to Emergency under `blood_in_stool`;
    - one swollen, red, painful leg stays RHU;
    - coarse "gitubol ko" is kept;
    - "wala ko kalibang" may be confused with the "no diarrhoea" phrase;
    - "giluod ko" may not mean feeling sick.
- **PR #32 (`feat/UT-005-nurse-followups`), merged 2026-11-17 (`7271a52`) at
  Philipo's request, branch kept:**
  - `v2.ts` gains 13 questions in en, tl and ceb;
  - R-057 to R-063 (Home to RHU) with 7 text thresholds;
  - needsClarification is switched on for the 13 codes.
  The engine, schema, API and apps are untouched. Tests: ruleset 10/10,
  engine 27/27, all JS workspaces, Pest 220/220.
- **Two changes after approval, awaiting the nurse's confirmation:**
  - The Tagalog is Claude's translation of the approved English.
  - **Five questions were recast** (toothache, eye, back pain, constipation,
    muscle pain). Their Emergency answers ran to 52-105 characters.
    `red_flag_answer` is VARCHAR(50) in *every* language, and the validator
    requires the same red-flag position in each language. Widening the column
    would mean a manuscript amendment. So the questions follow the approved
    headache pattern:
    - the signs move word for word into the question;
    - the Emergency answer is "Oo, usa o labaw pa";
    - the RHU answer is "Wala niini, pero ..." plus the approved wording.
    Every answer keeps its approved result.
- **Import file:** `Downloads\My_Care_ruleset_v2_nurse_review_2026-11-17.json`.
  - **Contents:** the PR's export plus 970 terms (v14's 447 with the 9 "not"
    phrases, plus the 523 approved phrases).
  - **Checks:**
    - every new phrase matches only its own symptom;
    - no existing phrase changed;
    - tap names are unchanged;
    - the importer accepts it as a draft on `mycare_test` (reset to empty
      afterwards), and the server serves the same 970 terms.
  - **It needs the code from PR #29 and later.** The live server runs older
    code, so redeploy from `main` after merging #32, then import, publish
    and force a device refresh.
- **Seen in passing:**
  - The `expression` text of R-051 to R-056 differs between the export (`!=
    "1 to 2 days"`) and the database (`!= fever_days_home`). It is display
    only; the conditions are identical, and it predates this change.
  - The PWA barangay-change unit test failed once under load beside Pest.
    It passed 3/3 alone and 78/78 in a clean run.

---

### 9au - A nurse validated the demo vocabulary and the v2 lexicon, for the pilot (2026-11-26)

On 2026-11-26 Philipo reported that "the lexicons in the demo app are now
validated". Asked which lexicon, he answered **both**:
- **The v2 nurse-review lexicon:** 970 terms in
  `Downloads\My_Care_ruleset_v2_nurse_review_2026-11-17.json` (9at). It is
  published locally as v15 and is not yet on the live server.
- **The demo-mode vocabulary** (`npm run dev:demo -w @mycare/pwa`): 428 terms
  on 24 symptom codes.
  - 124 come from kizaru3214's PR #2 draft, kept as the test fixture
    `packages/ruleset/src/testing/lexicon-fixture.ts`: 115 positive terms and
    9 negations.
  - 304 come from `DEMO_PHRASES` in `apps/pwa/src/demo.ts`.

**Who, when and scope, as Philipo gave them on 2026-11-26:**
- **Who:** a nurse. The nurse is not named, because consent to be named is not
  confirmed (9ar rule).
- **Demo vocabulary:** validated on 2026-11-06. The nurse also ran a UAT on
  the `dev:demo` build that day. The demo vocabulary has not changed since. The
  only later edit to `demo.ts` (`8374ba5`, 2026-11-15) changed chip labels,
  not terms.
- **v2 lexicon:** the whole 970-term file was re-validated on 2026-11-25. This
  is in addition to the approval of the 523 phrases on 2026-11-17 (9at).
- **Scope:** the pilot, for both.

**Philipo chose to record this only (Part 1 of the plan).**
- No import file was built, and no code changed.
- The fixture and `demo.ts` keep their "NOT CLINICALLY REVIEWED" headers.
- The guard test in `packages/ruleset/src/testing/testing.test.ts` stays, and
  v1 still publishes 0 terms.
- Demo vocabulary reaches patients only if it is imported and published as a
  ruleset version. That needs his go-ahead.

**This covers lexicon terms only.** Two items from 9at are questions, not
terms, and still await the nurse's confirmation:
- the Tagalog of the 13 follow-ups;
- the 5 recast questions.

**Open before any demo term enters a real ruleset:**
- **Did the validation accept the fixture's known bare-word mappings?**
  - A bare "fever" / "lagnat" / "hilanat" maps to `fever_mild`, a Home
    presentation. v2 then asks "How many days have you had the fever?" but
    asks nothing about danger signs.
  - A bare "chest pain" goes straight to Emergency.
- **The same mappings settle the manuscript's Recommendation 5 words:**
  imported, they would make "hilanat" and "lagnat" from the UAT session work.
- **Every demo term must be checked with the real matcher against the 970
  terms before import.** Each must match only its own code, change no existing
  term's match, and leave negations intact.

**Manuscript (flagged for Philipo, not amended):** two statements in the
Results are now stale:
- that the vocabulary "was approved by a member of the research team rather
  than a clinician";
- that the lexicon appraisal "did not yet produce reviewed vocabulary".

The manuscript also does not record the nurse's 2026-11-06 validation and UAT,
or the 2026-11-25 re-validation.

**PRODUCTION-CHECKLIST stays unchanged.** Section 1's "Enter the reviewed
lexicon terms" stays unticked: the terms are validated but not yet entered on
a server.
