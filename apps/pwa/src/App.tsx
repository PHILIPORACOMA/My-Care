import { useEffect, useMemo, useState } from "react";
import type { LanguageCode, RulesetBundle, ClarificationQuestion as ClarificationQuestionModel } from "@mycare/ruleset";
import { evaluate } from "@mycare/triage-engine";
import type { TriageResult, ClarificationAnswerInput } from "@mycare/triage-engine";
import { loadRulesetBundle } from "./lib/loadRulesetBundle.js";
import { translate } from "./lib/i18n.js";
import { buildLexiconIndex } from "./nlp/lexicon.js";
import { resolveSymptoms } from "./nlp/resolveSymptoms.js";
import { saveSession, clearSessions } from "./offline/db.js";
import { Splash } from "./screens/Onboarding/Splash.js";
import { LanguageSelect } from "./screens/Onboarding/LanguageSelect.js";
import { AgeGate } from "./screens/Onboarding/AgeGate.js";
import { BarangaySelect } from "./screens/Onboarding/BarangaySelect.js";
import { HomeScreen } from "./screens/Home/HomeScreen.js";
import { SymptomInputScreen } from "./screens/SymptomInput/SymptomInputScreen.js";
import { ClarificationQuestion } from "./screens/Clarification/ClarificationQuestion.js";
import { ProcessingScreen } from "./screens/Processing/ProcessingScreen.js";
import { ResultScreen } from "./screens/Results/ResultScreen.js";
import { HealthTipsScreen } from "./screens/HealthTips/HealthTipsScreen.js";
import { SettingsScreen } from "./screens/Settings/SettingsScreen.js";
import { InfoScreen } from "./screens/Settings/InfoScreen.js";
import type { AppStep } from "./types/index.js";

export function App() {
  const [bundle, setBundle] = useState<RulesetBundle | null>(null);
  const [step, setStep] = useState<AppStep>("splash");
  const [language, setLanguage] = useState<LanguageCode>("en");
  const [ageDeclined, setAgeDeclined] = useState(false);
  const [barangayCode, setBarangayCode] = useState<string | null>(null);
  const [symptomCodes, setSymptomCodes] = useState<string[]>([]);
  const [pendingQuestions, setPendingQuestions] = useState<ClarificationQuestionModel[]>([]);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [clarificationAnswers, setClarificationAnswers] = useState<ClarificationAnswerInput[]>([]);
  const [result, setResult] = useState<TriageResult | null>(null);
  const [settingsReturnTo, setSettingsReturnTo] = useState<AppStep>("home");

  useEffect(() => {
    void loadRulesetBundle().then(setBundle);
  }, []);

  const lexiconIndex = useMemo(() => (bundle ? buildLexiconIndex(bundle.lexiconTerms) : null), [bundle]);

  function t(key: string, vars?: Record<string, string | number>): string {
    return translate(language, key, vars);
  }

  function runTriage(codes: string[], answers: ClarificationAnswerInput[]) {
    if (!bundle || !barangayCode) return;
    const triageResult = evaluate({ symptomCodes: codes, clarificationAnswers: answers }, bundle);
    setResult(triageResult);
    setStep("result");
    void saveSession({
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      barangayCode,
      symptomCodes: codes,
      tier: triageResult.tier,
      rulesetVersion: bundle.versionLabel,
    });
  }

  function handleSymptomSubmit(rawText: string, quickSelectedCodes: string[]) {
    const fromText = lexiconIndex ? resolveSymptoms(rawText, lexiconIndex) : [];
    const codes = [...new Set([...fromText, ...quickSelectedCodes])];
    setSymptomCodes(codes);

    const questions = bundle?.clarificationQuestions.filter((q) => codes.includes(q.symptomCode)) ?? [];
    if (questions.length > 0) {
      setPendingQuestions(questions);
      setQuestionIndex(0);
      setClarificationAnswers([]);
      setStep("clarification");
    } else {
      setStep("processing");
      window.setTimeout(() => runTriage(codes, []), 900);
    }
  }

  function handleClarificationAnswer(answer: string) {
    const question = pendingQuestions[questionIndex];
    if (!question) return;
    const answers = [...clarificationAnswers, { questionKey: question.questionKey, answer }];
    setClarificationAnswers(answers);

    const isRedFlag = question.redFlagAnswer !== undefined && question.redFlagAnswer === answer;
    const isLastQuestion = questionIndex === pendingQuestions.length - 1;
    if (isRedFlag || isLastQuestion) {
      setStep("processing");
      window.setTimeout(() => runTriage(symptomCodes, answers), 900);
    } else {
      setQuestionIndex((i) => i + 1);
    }
  }

  function restartSymptomCheck() {
    setSymptomCodes([]);
    setPendingQuestions([]);
    setQuestionIndex(0);
    setClarificationAnswers([]);
    setResult(null);
    setStep("symptom");
  }

  function openSettings() {
    setSettingsReturnTo(step);
    setStep("settings");
  }

  async function handleStartOver() {
    await clearSessions();
    setBarangayCode(null);
    setAgeDeclined(false);
    restartSymptomCheck();
    setStep("splash");
  }

  if (!bundle) {
    return <p className="loading">{t("loadingRuleset")}</p>;
  }

  switch (step) {
    case "splash":
      return <Splash onGetStarted={() => setStep("language")} t={t} />;

    case "language":
      return (
        <LanguageSelect language={language} onSelect={setLanguage} onNext={() => setStep("ageGate")} t={t} />
      );

    case "ageGate":
      return (
        <AgeGate
          language={language}
          declined={ageDeclined}
          onBack={() => setStep("language")}
          onLanguageClick={openSettings}
          onConfirm={() => setStep("barangay")}
          onDecline={() => setAgeDeclined(true)}
          t={t}
        />
      );

    case "barangay":
      return (
        <BarangaySelect
          language={language}
          onBack={() => setStep("ageGate")}
          onLanguageClick={openSettings}
          onNext={(code) => {
            setBarangayCode(code);
            setStep("home");
          }}
          t={t}
        />
      );

    case "home":
      return (
        <HomeScreen
          language={language}
          barangayCode={barangayCode ?? ""}
          onCheckSymptoms={() => setStep("symptom")}
          onOpenSettings={openSettings}
          onLanguageClick={openSettings}
          t={t}
        />
      );

    case "symptom":
      return (
        <SymptomInputScreen
          language={language}
          symptomCodes={bundle.symptomCodes}
          onBack={() => setStep("home")}
          onLanguageClick={openSettings}
          onSubmit={handleSymptomSubmit}
          t={t}
        />
      );

    case "clarification": {
      const question = pendingQuestions[questionIndex];
      return question ? (
        <ClarificationQuestion
          language={language}
          question={question}
          current={questionIndex + 1}
          total={pendingQuestions.length}
          onBack={() => setStep("symptom")}
          onLanguageClick={openSettings}
          onAnswer={handleClarificationAnswer}
          t={t}
        />
      ) : null;
    }

    case "processing":
      return <ProcessingScreen t={t} />;

    case "result":
      return result ? (
        <ResultScreen
          tier={result.tier}
          language={language}
          matchedSymptomCodes={symptomCodes}
          symptomCodes={bundle.symptomCodes}
          onViewHealthTips={() => setStep("healthTips")}
          onCheckAgain={restartSymptomCheck}
          t={t}
        />
      ) : null;

    case "healthTips":
      return result ? (
        <HealthTipsScreen
          tier={result.tier}
          language={language}
          onBack={() => setStep("result")}
          onLanguageClick={openSettings}
          t={t}
        />
      ) : null;

    case "settings":
      return (
        <SettingsScreen
          language={language}
          rulesetVersion={bundle.versionLabel}
          onBack={() => setStep(settingsReturnTo)}
          onLanguageChange={setLanguage}
          onOpenAbout={() => setStep("about")}
          onOpenHelp={() => setStep("help")}
          onStartOver={() => void handleStartOver()}
          t={t}
        />
      );

    case "about":
      return <InfoScreen title={t("aboutMyCare")} body={t("aboutMyCareBody")} onBack={() => setStep("settings")} />;

    case "help":
      return (
        <InfoScreen title={t("helpDocumentation")} body={t("helpDocumentationBody")} onBack={() => setStep("settings")} />
      );
  }
}
