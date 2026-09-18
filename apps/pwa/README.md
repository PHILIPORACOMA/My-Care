# apps/pwa

Patient-facing app (Figures 15, 17-29): anonymous, offline-first, Cebuano/
Filipino/English symptom triage. Built to match the manuscript's mockups —
see `docs/REPO.md` for how this fits the rest of the monorepo.

## Flow

`Splash` -> `LanguageSelect` -> `AgeGate` -> `BarangaySelect` -> `HomeScreen`
-> `SymptomInputScreen` -> (optional, one at a time) `ClarificationQuestion`
-> `ProcessingScreen` -> `ResultScreen` -> (optional) `HealthTipsScreen`.
`SettingsScreen` (language switch, offline/ruleset status, About, Help,
"start over") is reachable from any screen's language chip or Home's gear
icon, and returns to wherever it was opened from.

All of this is orchestrated by `src/App.tsx` as a plain state machine — no
router, since the flow is a fixed tree, not free navigation.

## What's real vs. placeholder

- `src/nlp/`, `src/lib/loadRulesetBundle.ts`, and the call into
  `@mycare/triage-engine`'s `evaluate()` are wired end to end and work today,
  including multi-question clarification with red-flag short-circuiting.
- Free-text input now actually resolves symptoms: `resolveSymptoms.ts` does
  greedy longest-phrase matching against `packages/ruleset`'s
  `v1-lexicon-draft.ts`. That lexicon is an **unvalidated developer draft**,
  not sourced from the Clinical Plausibility and Content Validity Appraisal
  Form (see that file's header and `docs/REPO.md`) — expect wrong, missing,
  or clinically-imprecise phrasing, and replace it wholesale once real
  lexicon content exists rather than patching guesses in place.
  `SymptomInputScreen`'s 5 curated chips still mirror the manuscript's
  Figure 20 exactly; the "browse full symptom list" expander (not in the
  mockup) covers presentations the draft lexicon doesn't phrase well yet.
- `BarangaySelect` uses a placeholder list of 5 illustrative barangay names —
  there's no real LGU/RHU barangay data model in `packages/ruleset` yet.
- `src/i18n/*.json` are developer-written UI-chrome strings (buttons,
  prompts, result copy), not clinician-reviewed. Get a native Cebuano/
  Filipino speaker on the team to check them before this ships.
- `src/screens/HealthTips`: only the RHU tier has sourced tip copy (taken
  verbatim from the manuscript's Health Tips figure, then translated).
  Home/Emergency show a "coming soon" placeholder rather than invented
  clinical advice — that content needs to go through the project's Clinical
  Plausibility and Content Validity Appraisal process first.
- The emergency result's "Call for help" dials a placeholder national
  hotline (`911`) — swap for the barangay-specific hotline once that data
  model exists (see `EMERGENCY_HOTLINE` in `ResultScreen.tsx`).
- `public/sw.js` is a hand-written minimal app-shell cache, not generated
  from a build manifest.
- `src/offline/sync.ts` is a no-op until `apps/api` exists (Phase 3).
- Icons (`src/components/Icon.tsx`) are hand-drawn inline SVGs approximating
  the mockup's icon set, not pixel-identical to it.

## Commands

```bash
npm run dev -w @mycare/pwa
npm run typecheck -w @mycare/pwa
npm run test -w @mycare/pwa
```
