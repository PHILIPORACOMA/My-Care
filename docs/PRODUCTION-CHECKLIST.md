# From demo to production

Everything My Care needs before a real patient uses it. Written 2026-11-14.

**The demo itself is never deployed.** `npm run dev:demo` fills the device with
invented, unreviewed vocabulary (`apps/pwa/src/demo.ts`). Production is the
normal build plus **real, reviewed content entered through the console**. A
normal build contains none of the demo, and once a published ruleset carries
real lexicon terms the demo code steps aside on its own. So "going to
production" means replacing each demo-only piece with the real thing:

| What the demo shows | Where it comes from in the demo | What production needs instead |
|---|---|---|
| Free text is understood ("hilanat ko") | invented test lexicon (PR #2 draft) + `DEMO_PHRASES` | **reviewed Cebuano/Tagalog lexicon terms**, entered by Philipo |
| Chips in Tagalog and Cebuano | `DEMO_LABELS` drafts | reviewed tl/ceb names, entered as lexicon terms |
| A follow-up question decides the tier | invented `demo_abdominal_pain`, PR #19 | real clarification questions from the appraisal (Part C) |
| Results, advice, emergency text in tl/ceb | draft UI copy in `i18n.ts` | native-speaker and clinical review of that copy |
| "Call for help" dials a number | 911 fallback (no facilities) | the City Health Office's real numbers |
| Rules that triage | v1 in a local database | v1 published on a real server with the clinical-review attestation |

Owner key: **P** Philipo / team · **C** clinician / appraiser · **CHO** Carcar
City Health Office · **S** whoever runs the server.

---

## 1. Clinical content (blocks patients: nothing else matters until this is done)

- [ ] **P C** v1 sign-off paperwork: the reviewer's initials on the revised
      appraisal form (v1.1), one written confirmation for the appendix,
      clarification of the 8 under-triage flags, a scan of the completed form.
      The publish attestation in the console rests on this.
- [ ] **P** Type up Batch 2 Part C (the follow-up questions and answer choices)
      from the handwritten form.
- [ ] **P** Enter the **reviewed lexicon terms**: Cebuano, Tagalog and English
      words per symptom, with negations tagged. These also become the chip
      names in each language. Never copy from the demo vocabulary or the test
      fixture.
- [ ] **P C** Decide v2 (PR #20: 26 more complaints). Merge it, add the Part C
      questions and escalation comments, and get it clinically reviewed, or
      launch with v1 only.
- [ ] **P C** Health tips (Figure 28): none exist yet. Write them per tier and
      language, or accept an empty tips screen at launch.
- [ ] **P C** Native and clinical review of the tl/ceb UI copy in
      `apps/pwa/src/i18n.ts`. Most important: the three result verdicts, the
      advice under each, the disclaimer and the emergency instruction. Also the
      newer strings: body-area headings and the input-screen text (PR #21).
- [ ] **C** Check which body-area group each symptom sits in (PR #21), e.g.
      allergic reaction under skin, swollen legs under heart.

## 2. Decisions and open PRs

- [ ] **P** Merge or close the open PRs: #18 (unrecognised words → RHU
      fail-safe), #19 (demo-only, no effect on production), #20 (v2 draft),
      #21 (symptom input redesign), #23 (e2e for emergency numbers).
- [ ] **P** Does a true zero suppress? `SuppressionRule::render(0)` returns
      `<5` today. Decide before staff read real dashboards.

## 3. Partners and permission

- [ ] **P CHO** Agreement with the City Health Office / LGU on who operates
      the system after the capstone: who owns the server, who is the
      super-admin, who pays for hosting and the domain.
- [ ] **CHO** The facilities and emergency numbers list (the CSV, or entered in
      the console's Emergency numbers page).
- [ ] **CHO** The list of RHU / barangay health staff who need portal accounts.
- [ ] **P** RA 10173 (Data Privacy Act): confirm with your adviser or the
      City's data protection officer what a pilot needs, for example a privacy
      notice, a data-sharing agreement with the CHO, and whether NPC
      registration applies. The system collects no names, no free text and no
      GPS, which helps, but surveillance data is still covered.
      *(These items are a starting point, not legal advice; the repo has no
      ruling on them.)*

## 4. Server (docs/DEPLOYMENT.md does each step; CI proves the steps work)

- [ ] **S** Ubuntu 24.04 VPS, 1–2 vCPU, 2 GB RAM, 20 GB disk.
- [ ] **S** A domain name with its DNS `A` record pointing at the server.
- [ ] **S** HTTPS certificate (certbot). **Without HTTPS there is no offline
      mode at all.**
- [ ] **S** Read-only deploy key if the repository is private.
- [ ] **S** DEPLOYMENT.md steps 1–7: packages (PHP 8.4, MySQL 8, Node 20,
      nginx), firewall, database, code, `.env`, web server, `deploy.sh`.
- [ ] **S** Every item in DEPLOYMENT.md §12, the security checklist.
- [ ] **S** Backups copied **off** the server on a schedule, encrypted.

## 5. First run (DEPLOYMENT.md §8: people, not scripts)

- [ ] **P** Create the first super-admin (it prompts for the password).
- [ ] **P** Import v1 (lands as a draft) → Submit for review → **Publish**,
      ticking the clinical-review confirmation. Only on the signed appraisal.
- [ ] **P** Enter the reviewed lexicon terms as a new draft version, then
      publish it the same way.
- [ ] **P** Import or enter the emergency numbers; check each digit against
      what the CHO sent.
- [ ] **P** Create one sub-admin account per RHU/LGU staff member, scoped to
      their barangay. Staff set their own passwords.

## 6. Prove it before launch

- [ ] **S** DEPLOYMENT.md §9 checks: health, engine replay **ok**, scheduler
      running, online, **offline**, sync, portal scoping.
- [ ] **S** **Never run the Playwright suite against the production server.**
      Its setup runs `migrate:fresh` and the lexicon test publishes the
      invented test lexicon to whatever server it points at. The `deploy-smoke`
      CI job already runs it through a fresh, throwaway deploy on every PR;
      to test a real host, use a separate staging server.
- [ ] **P** A real low-end Android phone (close to Table 27: 2 GB RAM, Chrome):
      Playwright uses a current Chromium, so Chrome 80 compatibility is
      only proven on a real handset.
- [ ] **P** A field test in one barangay with weak signal: install, triage
      offline, come back into signal, confirm the portal shows the upload.
- [ ] **P C** Try typical patient sentences in Cebuano and Tagalog and confirm
      they match. Anything that doesn't is a missing lexicon term, not a code
      change.
- [ ] **P** Short training for RHU staff (portal) and the super-admin (console,
      including changing an emergency number).

## 7. Manuscript paperwork (not blocking launch, but owed)

- [ ] Table 19: add `created_at` in the .docx (approved amendment).
- [ ] Data Dictionary intro: say session records sync, not only aggregates.
- [ ] Figure 22's screenshot no longer matches the redesigned input screen
      (accepted; replace the image if you want them to match).

---

**Shortest path to a pilot:** finish §1's first three items, then §3's
facilities list and staff list, then §4 and §5 in one sitting, then §6.
Everything else can follow.
