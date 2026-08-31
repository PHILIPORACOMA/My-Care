<div align="center">

# My Care

**An AI-Powered Healthcare Triage and Management System for Geographically Isolated Areas**

An offline-first Progressive Web Application that performs deterministic health triage
entirely on a patient's own device — in Cebuano and Filipino, with no internet connection,
no account, and no personal data collected.

[![CI (web)](https://github.com/OWNER/my-care/actions/workflows/ci-web.yml/badge.svg)](https://github.com/OWNER/my-care/actions/workflows/ci-web.yml)
[![CI (api)](https://github.com/OWNER/my-care/actions/workflows/ci-api.yml/badge.svg)](https://github.com/OWNER/my-care/actions/workflows/ci-api.yml)
![License](https://img.shields.io/badge/license-MIT-blue)
![PHP](https://img.shields.io/badge/PHP-8.4-777BB4)
![Node](https://img.shields.io/badge/Node-20-339933)
![React](https://img.shields.io/badge/React-18-61DAFB)
![Laravel](https://img.shields.io/badge/Laravel-11-FF2D20)

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
| **Works fully offline** | Triage runs on-device. No network call, ever. |
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
   Clinical Plausibility and Content Validity Appraisal Form.
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
- **`apps/api`** — Laravel 11 + MySQL 8.

The triage engine lives in **`packages/triage-engine`** as a standalone package with
**zero runtime dependencies**. It cannot import React, call `fetch`, read
`localStorage`, or use `Date.now()` — a CI job fails the build if it tries.

## Tech stack

| Layer | Choice |
|---|---|
| Patient / admin frontends | React 18 · TypeScript · Vite |
| Offline storage | Service Worker · IndexedDB |
| Triage engine | Pure TypeScript, zero dependencies |
| Backend | Laravel 11 · PHP 8.4 |
| Database | MySQL 8 |
| Testing | Vitest · Pest |
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

Backend:

```bash
cd apps/api
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

Frontends:

```bash
npm run dev:pwa       # patient app
npm run dev:portal    # RHU / LGU dashboard
npm run dev:console   # super-admin console
```

Full setup notes, repository conventions, and the Laravel domain layout are in
[`docs/REPO.md`](docs/REPO.md).

## Project status

| Phase | Scope | Status |
|---|---|---|
| 0 | Monorepo, CI, conventions | ✅ Done |
| 1 | Triage engine + ruleset schema | ✅ Done |
| 2 | Ruleset v1 (clinical appraisal) | 🔨 In progress |
| 3 | Laravel API + 20 migrations | ⬜ Planned |
| 4 | Super-admin console | ⬜ Planned |
| 5 | Patient PWA | ⬜ Planned |
| 6 | Offline sync layer | ⬜ Planned |
| 7 | Sub-admin dashboard | ⬜ Planned |
| 8 | Integration + offline E2E | ⬜ Planned |
| 9 | Deployment | ⬜ Planned |

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
