import type { SymptomMatch } from "@mycare/lexicon-matcher";
import type { ClarificationQuestion, LanguageCode } from "@mycare/ruleset";
import type { TriageResult } from "@mycare/triage-engine";
import { useCallback, useEffect, useMemo, useState } from "react";
import { deviceApi, OfflineError } from "./api";
import { LANGUAGES, translatorFor } from "./i18n";
import { AgeScreen, BarangayScreen, LanguageScreen, SplashScreen } from "./screens/Onboarding";
import { ClarifyScreen, InputScreen, ProcessingScreen } from "./screens/Check";
import { HomeScreen } from "./screens/Home";
import { ResultScreen, TipsScreen } from "./screens/Result";
import { SettingsScreen } from "./screens/Settings";
import {
  clearEverything,
  readPrefs,
  writePrefs,
  type Barangay,
  type Prefs,
} from "./storage";
import {
  BundleUnavailable,
  ensureRegistered,
  onSyncState,
  recordSession,
  refreshBundle,
  refreshFacilities,
  startSync,
  type BundleBlocker,
  type SyncState,
} from "./sync";
import {
  buildSession,
  canonicalAnswer,
  chipsFor,
  matchSymptoms,
  questionsFor,
  runTriage,
  symptomLabel,
  tipsFor,
  type TriageInputState,
} from "./triage";

type Screen =
  | "loading"
  | "splash"
  | "language"
  | "age"
  | "barangay"
  | "home"
  | "input"
  | "clarify"
  | "processing"
  | "result"
  | "tips"
  | "settings";

interface Check {
  startedAt: string;
  text: string;
  picked: string[];
  answers: Record<string, string>;
  questions: ClarificationQuestion[];
  questionIndex: number;
  result?: TriageResult;
}

const emptyCheck = (): Check => ({
  startedAt: new Date().toISOString(),
  text: "",
  picked: [],
  answers: {},
  questions: [],
  questionIndex: 0,
});

/**
 * The patient app (Figures 17–29).
 *
 * A screen state machine rather than a router: there are no URLs to share, no
 * history to leave behind on a shared phone, and back always means the one
 * step the storyboard shows.
 *
 * What the patient types lives in this component's state for the length of one
 * check and is never written to disk (CLAUDE.md #8). Only resolved symptom
 * codes reach IndexedDB, and only those sync.
 */
export function App() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [prefs, setPrefs] = useState<Prefs>({});
  const [barangays, setBarangays] = useState<Barangay[]>([]);
  const [choice, setChoice] = useState<Barangay>();
  const [check, setCheck] = useState<Check>(emptyCheck);
  const [sync, setSync] = useState<SyncState>({ pending: 0, syncing: false });
  const [busy, setBusy] = useState(false);
  /*
   * Why the device has no rules, when it has none. Held as a reason rather
   * than a message so the screens can word it themselves: a 503 from a
   * reachable server used to be reported to the patient as "no internet",
   * which sends someone looking for signal they do not need.
   */
  const [blocker, setBlocker] = useState<BundleBlocker>();
  const blockerBody = (reason: BundleBlocker) =>
    reason === "offline" ? t("needConnectionBody") : reason === "unpublished" ? t("noRulesBody") : t("serverProblemBody");

  const language: LanguageCode = prefs.language ?? "en";
  const t = useMemo(() => translatorFor(language), [language]);
  const bundle = prefs.bundle?.bundle;

  // First paint: read what the device already knows, then decide where to land.
  useEffect(() => {
    void (async () => {
      const stored = await readPrefs();
      setPrefs(stored);
      setBarangays(stored.barangays ?? []);
      setScreen(stored.barangay && stored.ageConfirmed ? "home" : "splash");

      if (stored.device) {
        void refreshBundle()
          .then((fresh) => {
            if (fresh) setPrefs((p) => ({ ...p, bundle: fresh }));
            setBlocker(undefined);
          })
          .catch((e: unknown) => setBlocker(e instanceof BundleUnavailable ? e.reason : "server"));
        void refreshFacilities();
      }
    })();

    const stopSync = startSync();
    const stopListening = onSyncState(setSync);
    return () => {
      stopSync();
      stopListening();
    };
  }, []);

  const save = useCallback(async (changes: Partial<Prefs>) => {
    setPrefs(await writePrefs(changes));
  }, []);

  /** The barangay list is public and cached; onboarding needs it once. */
  const loadBarangays = useCallback(async () => {
    if (barangays.length > 0) return;
    try {
      const fetched = await deviceApi.barangays();
      setBarangays(fetched);
      await save({ barangays: fetched });
      setBlocker(undefined);
    } catch (e) {
      setBlocker(e instanceof OfflineError ? "offline" : "server");
    }
  }, [barangays.length, save]);

  /**
   * Confirming a barangay is also this installation's first contact with the
   * server: it registers anonymously and pulls the ruleset. Offline, the
   * choice is still saved and the home screen explains what is missing.
   */
  async function confirmBarangay() {
    if (!choice) return;
    setBusy(true);
    setBlocker(undefined);
    try {
      await save({ barangay: choice });
      await ensureRegistered(choice.id);
      await refreshBundle(true);
      await refreshFacilities();
      setPrefs(await readPrefs());
    } catch (e) {
      // Whatever went wrong, the barangay is saved and the patient reaches
      // home; the banner there explains what is missing and who fixes it.
      setBlocker(e instanceof BundleUnavailable ? e.reason : e instanceof OfflineError ? "offline" : "server");
    } finally {
      setBusy(false);
      setScreen("home");
    }
  }

  const matches: SymptomMatch[] = useMemo(
    () => (bundle ? matchSymptoms(check.text, bundle.lexiconTerms) : []),
    [bundle, check.text]
  );

  const input: TriageInputState = { picked: check.picked, matches, answers: check.answers };
  const codes = useMemo(() => [...new Set([...matches.filter((m) => !m.negated).map((m) => m.symptomCode), ...check.picked])], [matches, check.picked]);

  /** Ask what needs asking, then evaluate (Figures 23, 24). */
  function startCheck() {
    if (!bundle) return;
    const questions = questionsFor(bundle, codes, language);
    setCheck((c) => ({ ...c, questions, questionIndex: 0 }));
    setScreen(questions.length > 0 ? "clarify" : "processing");
  }

  function answerQuestion(answerIndex: number) {
    if (!bundle) return;
    const question = check.questions[check.questionIndex];
    if (!question) return;

    const answers = { ...check.answers, [question.questionKey]: canonicalAnswer(bundle, question.questionKey, answerIndex) };
    const nextIndex = check.questionIndex + 1;
    setCheck((c) => ({ ...c, answers, questionIndex: nextIndex }));
    if (nextIndex >= check.questions.length) setScreen("processing");
  }

  /** The engine decides; the result is queued for sync and shown. */
  async function finishCheck() {
    if (!bundle || !prefs.barangay) return;

    const result = runTriage(bundle, input);
    setCheck((c) => ({ ...c, result }));
    setScreen("result");

    await recordSession(
      buildSession({
        bundle,
        input,
        result,
        barangayId: prefs.barangay.id,
        language,
        startedAt: check.startedAt,
      })
    );
  }

  function newCheck() {
    setCheck(emptyCheck());
    setScreen("home");
  }

  if (screen === "loading") {
    return (
      <div className="screen">
        <div className="grow">
          <div className="spinner" />
        </div>
      </div>
    );
  }

  const languageLabel = LANGUAGES.find((l) => l.code === language)?.label ?? "English";

  switch (screen) {
    case "splash":
      return <SplashScreen t={t} onStart={() => setScreen("language")} />;

    case "language":
      return (
        <LanguageScreen
          t={t}
          language={language}
          onSelect={(next) => void save({ language: next })}
          onContinue={() => setScreen("age")}
        />
      );

    case "age":
      return (
        <AgeScreen
          t={t}
          onBack={() => setScreen("language")}
          onConfirm={() => {
            void save({ ageConfirmed: true });
            void loadBarangays();
            setScreen("barangay");
          }}
          // "Sessions where the user declines are not recorded" (Figure 19).
          onDecline={() => undefined}
        />
      );

    case "barangay":
      return (
        <BarangayScreen
          t={t}
          barangays={barangays}
          selected={choice ?? prefs.barangay}
          busy={busy}
          error={blocker && blockerBody(blocker)}
          onBack={() => setScreen("age")}
          onSelect={setChoice}
          onConfirm={() => void confirmBarangay()}
        />
      );

    case "home":
      return (
        <HomeScreen
          t={t}
          barangayName={prefs.barangay?.name ?? ""}
          languageLabel={languageLabel}
          blocker={bundle ? undefined : (blocker ?? "offline")}
          onCheck={() => {
            setCheck(emptyCheck());
            setScreen("input");
          }}
          onSettings={() => setScreen("settings")}
        />
      );

    case "input":
      return (
        <InputScreen
          t={t}
          text={check.text}
          onText={(text) => setCheck((c) => ({ ...c, text }))}
          chips={bundle ? chipsFor(bundle, language) : []}
          picked={check.picked}
          onToggleChip={(code) =>
            setCheck((c) => ({ ...c, picked: c.picked.includes(code) ? c.picked.filter((x) => x !== code) : [...c.picked, code] }))
          }
          matches={matches}
          canContinue={codes.length > 0}
          onBack={() => setScreen("home")}
          onContinue={startCheck}
        />
      );

    case "clarify": {
      const question = check.questions[check.questionIndex];
      if (!question) {
        setScreen("processing");
        return null;
      }
      return (
        <ClarifyScreen
          t={t}
          question={question}
          index={check.questionIndex}
          total={check.questions.length}
          onBack={() => (check.questionIndex === 0 ? setScreen("input") : setCheck((c) => ({ ...c, questionIndex: c.questionIndex - 1 })))}
          onAnswer={answerQuestion}
        />
      );
    }

    case "processing":
      return <ProcessingScreen t={t} onDone={() => void finishCheck()} />;

    case "result":
      return check.result && prefs.barangay ? (
        <ResultScreen
          t={t}
          result={check.result}
          chips={bundle ? codes.map((code) => symptomLabel(bundle, code, language)) : codes}
          facilities={prefs.facilities ?? []}
          barangayId={prefs.barangay.id}
          onTips={() => setScreen("tips")}
          onAgain={newCheck}
        />
      ) : null;

    case "tips":
      return check.result && bundle ? (
        <TipsScreen
          t={t}
          tier={check.result.tier}
          tips={tipsFor(bundle, check.result.tier, codes, language)}
          onBack={() => setScreen("result")}
        />
      ) : null;

    case "settings":
      return (
        <SettingsScreen
          t={t}
          language={language}
          bundle={prefs.bundle}
          pending={sync.pending}
          lastSyncAt={prefs.lastSyncAt}
          onLanguage={(next) => void save({ language: next })}
          onBack={() => setScreen("home")}
          onStartOver={async () => {
            await clearEverything();
            setPrefs({});
            setChoice(undefined);
            setCheck(emptyCheck());
            setScreen("splash");
          }}
        />
      );

    default:
      return null;
  }
}
