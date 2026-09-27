<div align="center">

# My Care

**An AI-Powered Healthcare Triage and Management System for Geographically Isolated Areas**

An offline-first Progressive Web Application that performs deterministic health triage
entirely on a patient's own device — in Cebuano and Filipino, with no internet connection,
no account, and no personal data collected.

[![api](https://github.com/PHILIPORACOMA/My-Care/actions/workflows/api.yml/badge.svg)](https://github.com/PHILIPORACOMA/My-Care/actions/workflows/api.yml)
[![e2e](https://github.com/PHILIPORACOMA/My-Care/actions/workflows/e2e.yml/badge.svg)](https://github.com/PHILIPORACOMA/My-Care/actions/workflows/e2e.yml)
[![engine-purity](https://github.com/PHILIPORACOMA/My-Care/actions/workflows/engine-purity.yml/badge.svg)](https://github.com/PHILIPORACOMA/My-Care/actions/workflows/engine-purity.yml)
![License](https://img.shields.io/badge/license-MIT-blue)
![PHP](https://img.shields.io/badge/PHP-8.4-777BB4)
![Node](https://img.shields.io/badge/Node-20-339933)
![React](https://img.shields.io/badge/React-18-61DAFB)
![Laravel](https://img.shields.io/badge/Laravel-13-FF2D20)

Capstone project · BS Information Technology
College of Computer Studies, University of Cebu — Main Campus

</div>

---

## The problem

The Philippines is 7,641 islands. Over 50 million Filipinos live in rural barangays,
and **53% of the population cannot reach a rural health unit within 30 minutes**
(Reyes et al., 2025). In the Geographically Isolated and Disadvantaged Areas (GIDA)
of Carcar City, Cebu, upland barangays sit above 660 metres with slopes over 50%.

When people there get sick, the realistic options are to self-medicate, consult an
*albularyo*, or search the internet — each of which delays detection of conditions
like tuberculosis, hypertension, and dengue.

Existing symptom checkers do not solve this. Ada Health, WebMD, and Symptomate all
require a live internet connection, operate in English, and route users to
foreign healthcare systems. mWell and KonsultaMD require paid subscriptions and
enough bandwidth for a video call.

**None of them work when there is no signal.**

## What My Care does

| | |
|---|---|
| **Works fully offline** | Triage itself makes no network call. The device fetches rules and uploads records when it has signal — never to decide a tier. |
| **Speaks the language** | Free-text symptom input in Cebuano and Filipino. |
| **Anonymous by design** | No account, no login, no personally identifying information. |
| **Explainable** | Every result traces to the exact rule that produced it. |
| **Runs on cheap phones** | 2 GB RAM, Snapdragon 400-series, Chrome 80+. |
| **Feeds public health** | De-identified barangay aggregates for LGU surveillance. |

A patient types *"hilanat ug ubo, tulo ka adlaw na"*, answers a clarifying question or
two, and receives one of three outcomes:

🟢 **Home management** — self-care guidance
🟡 **RHU referral** — visit the Rural Health Unit within 24 hours
🔴 **Emergency referral** — seek emergency care immediately

The amber and red screens double as paper-free referral slips: the patient shows
the screen to a health worker, who sees the matched symptoms immediately.

## Why it is deterministic, not generative

This is the central design decision, and it is deliberate.

My Care uses a **lexicon-driven NLP layer** feeding a **deterministic rule engine** —
no large language model, no probabilistic inference at the triage step. Given identical
inputs, it returns identical outputs, forever, and every outcome carries a full trace
of the rules that fired.

This matters for three reasons:

1. **Safety.** Generative models hallucinate. In a triage context that is not an
   inconvenience, it is a clinical hazard (Roustan & Bastardot, 2025).
2. **Auditability.** A clinician can review the rule set before deployment and know
   exactly what the system will do. Rules are appraised via a formal
   Clinical Plausibility and Content Validity Appraisal Form. The v1 rule table —
   23 presentations, 6 home / 8 RHU / 9 emergency — has been appraised on that
   form, and the encoded ruleset was verified row by row against it.
3. **It fits the hardware.** A quantised transformer exceeds the entire 100 MB storage
   budget of the minimum target device. The engine ships in kilobytes.

Rule-based triage protocols have been shown to match AI-based triage on safety while
over-triaging fewer non-critical patients (Gellert et al., 2023).

> **The engine may never guess a tier.** The NLP layer proposes symptom codes;
> only the rule engine assigns urgency. This boundary is enforced in CI.

## Architecture

```
┌─────────────────────────────────────────────┐
│  PATIENT DEVICE — fully offline             │
│                                             │
│   free text ──▶ lexicon match ──▶ negation  │
│                       │                     │
│                       ▼                     │
│              deterministic rule engine      │
│                       │                     │
│                       ▼                     │
│              🟢 home  🟡 RHU  🔴 emergency   │
└──────────────────┬──────────────────────────┘
                   │  de-identified session records only
                   │  (raw symptom text never leaves the device)
                   ▼
┌─────────────────────────────────────────────┐
│  LARAVEL API                                │
│  aggregation · <5 suppression · audit log   │
└──────────┬───────────────────┬──────────────┘
           ▼                   ▼
   RHU / LGU portal      Super-admin console
   trends · reports      rule authoring · publish
```

Three client surfaces, one backend:

- **`apps/pwa`** — patient app. Anonymous, offline-first, low-end devices.
- **`apps/portal`** — RHU and LGU staff. Read-only, scoped to one barangay.
- **`apps/console`** — development team. Rule authoring, lexicon, publishing, audit.
- **`apps/api`** — Laravel 13 + MySQL 8.

Shared packages: **`ruleset`** (the contract between API and device),
**`triage-engine`**, **`lexicon-matcher`** (free text → symptom codes, never a tier),
**`engine-replay`** (the server replays stored sessions through the real engine),
**`api-client`** and **`ui`** (staff apps only — the patient app shares neither).

The triage engine lives in **`packages/triage-engine`** as a standalone package with
**zero runtime dependencies**. It cannot import React, call `fetch`, read
`localStorage`, or use `Date.now()` — a CI job fails the build if it tries. The same
check guards `lexicon-matcher`.

## Tech stack

| Layer | Choice |
|---|---|
| Patient / admin frontends | React 18 · TypeScript · Vite |
| Offline storage | Service Worker · IndexedDB |
| Triage engine | Pure TypeScript, zero dependencies |
| Backend | Laravel 13 · PHP 8.4 |
| Database | MySQL 8 |
| Testing | Vitest · Pest · Playwright |
| CI | GitHub Actions |

## Getting started

Requires **Node 20**, **PHP 8.4**, **Composer 2**, and **MySQL 8**.

```bash
git clone https://github.com/OWNER/my-care.git
cd my-care
npm install
```

Run the triage engine test suite — this exercises the core clinical logic and
needs no database:

```bash
npm test -w @mycare/triage-engine
```

Two build steps the backend depends on — the server replays sessions through the
real engine under Node (ADR-0007), and the importer reads an exported bundle:

```bash
npm run build -w @mycare/engine-replay
npm run export:v1 -w @mycare/ruleset
```

Backend:

```bash
cd apps/api
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed          # includes the 15 Carcar barangays
php artisan serve

php artisan mycare:ruleset:import ../../packages/ruleset/dist/v1.json
php artisan mycare:staff:create-super-admin you@example.org
```

An imported ruleset lands as a **draft**. It reaches no device until a super-admin
publishes it in the console, which records who attested to the clinical review.

Frontends — each proxies `/api` to the backend on port 8000:

```bash
npm run dev -w @mycare/pwa        # patient app        → :5173
npm run dev -w @mycare/portal     # RHU / LGU dashboard → :5174/portal/
npm run dev -w @mycare/console    # super-admin console → :5175
```

Everything at once, plus the Pest suite:

```bash
npm test                          # every workspace
npm run typecheck
cd apps/api && ./vendor/bin/pest  # needs MySQL 8, never SQLite
```

## End-to-end tests (Playwright)

The unit suites prove each piece on its own. The Playwright suite in
[`e2e/`](e2e) proves they work together: all three apps in a real Chromium,
against the real Laravel API and a real MySQL 8 database. Nothing is stubbed.

```bash
npx playwright install chromium   # once per machine
npm run e2e -w @mycare/e2e        # the whole suite
npm run e2e:report -w @mycare/e2e # open the HTML report of the last run
```

**Before you run it:** MySQL 8 must be up, and `apps/api/.env` must hold working
database credentials (the suite reuses them). The API's `composer install` must
have been run. Nothing else needs starting by hand.

**What a run does by itself:**

1. **Builds its own world** (`e2e/global-setup.ts`). It builds `engine-replay`,
   exports the v1 bundle, then wipes and rebuilds a separate schema,
   **`mycare_e2e`**, and publishes v1 there with two test staff accounts.
   Your development database (`mycare`) is never touched, and the seeder refuses
   to run against any other schema.
2. **Starts its own servers on its own ports**, so it never collides with your
   dev servers:

   | Server | E2E port | Dev port |
   |---|---|---|
   | Laravel API | 8100 | 8000 |
   | Patient app (**production build**) | 4273 | 5173 / 4173 |
   | RHU / LGU portal | 5274 | 5174 |
   | Super-admin console | 5275 | 5175 |

   The patient app runs from its production build on purpose: the dev server
   registers no service worker, so an offline test against it would prove
   nothing.
3. **Runs the specs serially** (one worker, one shared database), patient
   first, then staff. The staff screens read what the patient journey synced.

**What it covers:**

| Spec | Proves | Test cases |
|---|---|---|
| `patient.offline.spec.ts` | Onboard with signal and cache the rules. Hard-reload with no network and triage all three tiers from the cache. Upload on reconnect, and a retried upload is not double-counted. No unexpected console errors. | UT-001, UT-006, UT-012, UT-013, UT-015 |
| `patient.first-run-offline.spec.ts` | Choose a barangay with no signal ever; setup finishes by itself once signal returns. | UT-001 |
| `portal.smoke.spec.ts` | A sub-admin sees only their barangay, the sync status is current, and the journey's sessions render as `<5`. | UT-014, UT-016, UT-020 |
| `console.smoke.spec.ts` | A super-admin signs in and every screen renders. | — |

The phone is emulated at 360 × 640 with touch. Playwright ships a current
Chromium, so the suite does **not** prove Chrome 80 compatibility. That rests on
the build target (`chrome80`) and a real handset.

**Output** (all gitignored): the HTML report in `e2e/playwright-report/`,
traces and failure screenshots in `e2e/test-results/`, and the screenshots of
each patient screen (Figures 17–27) in `e2e/screenshots/`.

**Against a deployed server:** set `E2E_BASE_URL` and no servers are started;
the suite targets `/`, `/portal/` and `/console/` on that host. The CI
`deploy-smoke` job does this against nginx and PHP-FPM. See
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

**In CI:** the `e2e` workflow runs the whole suite on every pull request and
every push to `main`, with a MySQL 8 service container, and uploads the report
and screenshots as the `playwright` artifact (kept 14 days).

Full setup notes, repository conventions, the Laravel domain layout and the
Windows-specific gotchas are in [`docs/REPO.md`](docs/REPO.md) and
[`docs/STATUS.md`](docs/STATUS.md).

## Project status

| Phase | Scope | Status |
|---|---|---|
| 0 | Monorepo, CI, conventions | ✅ Done |
| 1 | Triage engine + ruleset schema | ✅ Done — 12 tests, purity enforced |
| 2 | Ruleset v1 (clinical appraisal) | ✅ Encoded and appraised |
| 3 | Laravel API + 20 migrations | ✅ Done — Pest 176 passed, 716 assertions |
| 4 | Super-admin console | ✅ Done |
| 5 | Patient PWA | ✅ Done — 24 tests; not yet opened in a browser |
| 6 | Offline sync layer | ✅ Done — both server and device halves |
| 7 | Sub-admin dashboard | ✅ Done |
| 8 | Integration + offline E2E | 🔨 Next — Playwright, and CI for the new workspaces |
| 9 | Deployment | ⬜ Planned |

Phases 3–8 are on `feat/UT-020-laravel-api-schema` (PR #1), built under a standing
rule of **no manuscript amendments**: where the schema and the code disagreed, the
gap was closed in code and documented, never by editing the specification.
[`docs/BUILD-LOG.md`](docs/BUILD-LOG.md) records every one of those decisions.

## Privacy

Privacy is architectural here, not a policy document.

- Patients use the app **anonymously**. No account, no login, no name, no phone number.
- **Raw symptom text never leaves the device.** Only de-identified session records sync.
- Barangay-level aggregates apply a **minimum-count suppression rule**: any bucket with
  fewer than five sessions renders as `<5`, never a raw number. This applies identically
  to the live dashboard, the map, and every CSV and PDF export.
- The barangay comes from an explicit user selection during onboarding. **GPS is never
  requested or used.**

Consistent with Republic Act No. 10173 (Data Privacy Act of 2012).

## Team

| Member | Modules (Manuscript Table 30) |
|---|---|
| **Carl David L. Binghay** — Project Manager | Sync & data aggregation |
| **Philipo L. Racoma** | Lexicon matching · rule authoring · triage configuration |
| **Ancline April Seaborg** | Rule-based tier classification · results · sync monitoring |
| **Gil A. Tabañag** | Surveillance dashboard · aggregate map · reporting |

**Adviser:** Mr. Gian Carlo Cataraja, MIT
**Dean, College of Computer Studies:** Mr. Neil A. Basabe, DIT

## Academic traceability

This repository implements a defended capstone manuscript. Traceability is enforced
rather than assumed:

- Every pull request cites the manuscript test case ID and figure or table it implements.
- Unit tests map explicitly to test cases **UT-001** through **UT-020**
  (see [`docs/ut-matrix.md`](docs/ut-matrix.md)).
- Database column names match the Data Dictionary (Tables 5–24) exactly.
- Architectural decisions are recorded as ADRs in [`docs/adr/`](docs/adr).

## Acknowledgements

To the Local Government Unit, Rural Health Unit, and Barangay Health Workers of
Carcar City, Cebu — whose frontline experience shaped every design decision in
this system.

## License

[MIT](LICENSE) — free to use, adapt, and deploy. If this helps another GIDA
community, that is the point.
