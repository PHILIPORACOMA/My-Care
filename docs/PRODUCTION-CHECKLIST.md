# From demo to production

Everything My Care needs before a real patient uses it. **This is the progress
tracker:** tick an item when it is done, with the date, update the counts, and
add a line to the log at the bottom. Started 2026-11-14.

## Progress

| Section | Done | Status |
|---|---|---|
| 1. Clinical content | 0 / 12 | ⛔ blocks launch. v2 merged as a draft, not yet reviewed |
| 2. Decisions and open PRs | 1 / 2 | all PRs merged; zero-suppression open |
| 3. Partners and permission | 0 / 4 | not started |
| 4. Server | 0 / 7 | not started; scripted and CI-proven |
| 5. First run | 0 / 5 | waits on 1, 3 and 4 |
| 6. Prove it before launch | 0 / 5 | waits on 5 |
| 7. Manuscript paperwork | 0 / 3 | not blocking |
| 8. Code health | 0 / 1 | not blocking |
| **Total** | **1 / 39** | |

**Next up:** §1's first three items (v1 paperwork, Part C, lexicon terms) and
§3's facilities and staff lists. They are all people's work, and everything
after them depends on them.

---

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
- [ ] **P C** v2 (26 more complaints): add the Part C questions and escalation
      comments, and get it clinically reviewed, or launch with v1 only.
      *2026-11-14: merged into the code as a draft bundle (PR #20); nothing
      publishes it.*
- [ ] **P C** Health tips (Figure 28): none exist yet. Write them per tier and
      language, or accept an empty tips screen at launch.
- [ ] **P** Tagalog and Cebuano chip names for v1: approved by Philipo
      2026-11-15 (BUILD-LOG 9w). Import
      `My_Care_ruleset_v1_tagalog_cebuano_chip_names_2026-11-15.json` on the
      server and publish it from the console.
- [ ] **P C** Tagalog and Cebuano chip names for the 27 new v2 symptoms: check
      Claude's drafts in `My_Care_Chip_Names_v2_Sheet_with_Cebuano_draft_2026-11-15.docx`
      (BUILD-LOG 9af, 9ag). Until then those chips show in English.
- [ ] **P C** Native and clinical review of the tl/ceb UI copy in
      `apps/pwa/src/i18n.ts`. Most important: the three result verdicts, the
      advice under each, the disclaimer and the emergency instruction. Also the
      newer strings: body-area headings and the input-screen text (PR #21).
- [ ] **C** Unrecognised words (BUILD-LOG 9x): should they ever go to
      Emergency, and is a "confused, very sleepy or can't speak: get help
      now" line wanted on that screen? Both are clinical calls.
- [ ] **C** Severe-or-not follow-ups (BUILD-LOG 9ae): confirm chest pain "No"
      goes to the RHU (or Home), approve the stomach tip and its tl/ceb
      wording, and say whether any other home advice belongs in it.
- [ ] **P C** Plain stomach and chest phrases: approve the sheet
      `My_Care_Plain_Stomach_Chest_Phrase_Sheet_2026-11-15.docx`.
- [ ] **C** Check which body-area group each symptom sits in (PR #21), e.g.
      allergic reaction under skin, swollen legs under heart.

## 2. Decisions and open PRs

- [x] **P** Merge or close the open PRs (#18–#23). *Done 2026-11-14: all
      merged (BUILD-LOG 9u).*
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

> ⚠️ **Never run the Playwright suite against the production server.** Its
> setup runs `migrate:fresh` and the lexicon test publishes the invented test
> lexicon to whatever server it points at. The `deploy-smoke` CI job already
> runs it through a fresh, throwaway deploy on every PR; to test a real host,
> use a separate staging server.

- [ ] **S** DEPLOYMENT.md §9 checks: health, engine replay **ok**, scheduler
      running, online, **offline**, sync, portal scoping.
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

## 8. Code health (not blocking launch)

- [ ] Make the two flaky tests wait properly (BUILD-LOG 9u): the portal's
      "names the health worker's own barangay" and the PWA's "with no signal,
      keeps triaging under the new barangay". Test timing only; the app is
      correct.

---

**Shortest path to a pilot:** finish §1's first three items, then §3's
facilities and staff lists, then §4 and §5 in one sitting, then §6.
Everything else can follow.

## Log

- **2026-11-14:** checklist written. PRs #18–#23 merged; v2 is on main as a
  draft. 1 / 34.
- **2026-11-15:** added §1 "Tagalog chip names for v1" (BUILD-LOG 9v): the
  import file is ready, not yet published. 1 / 35.
- **2026-11-15:** v1 chip names approved in both languages; the import file
  is ready, not yet published. 1 / 35.
- **2026-11-15:** added §1 "Unrecognised words" (BUILD-LOG 9x); PR #25 adds a
  call button to that result. 1 / 36.
- **2026-11-15:** Batch 2 scan received; transcription sheet made for Philipo to
  type Part B words, Part C questions and the unclear handwriting (BUILD-LOG
  9y). Nothing ticked. 1 / 36.
- **2026-11-15:** Batch 2 transcription sheet checked by Philipo. Part B phrases
  drafted by Claude (272, nine emergency presentations) for a reviewer to
  approve (BUILD-LOG 9z). Nothing ticked. 1 / 36.
- **2026-11-15:** severe-or-not follow-ups built in the v2 draft (PR #27, BUILD-LOG
  9ae); two new items for the appraiser and a phrase sheet to approve. 1 / 38.
- **2026-11-15:** 25 chips found still in English in Cebuano (the new v2 symptoms);
  chip names sheet made (BUILD-LOG 9af). 1 / 39.
- **2026-11-15:** Cebuano chip names drafted by Claude for Philipo to check (BUILD-LOG
  9ag). Nothing ticked. 1 / 39.
