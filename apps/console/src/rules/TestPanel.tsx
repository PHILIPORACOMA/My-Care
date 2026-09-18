import type { RulesetContent, SymptomCodeEntry } from "@mycare/api-client";
import { matchSymptoms } from "@mycare/lexicon-matcher";
import type { RulesetBundle } from "@mycare/ruleset";
import { evaluate, type TriageResult } from "@mycare/triage-engine";
import { Banner, Card, TextAreaField, TextField, TierBadge } from "@mycare/ui";
import { useMemo, useState } from "react";

const REASONS: Record<TriageResult["reason"], string> = {
  red_flag_clarification: "A red-flag clarification answer forced emergency (checked first).",
  severity_override: "A red-flag severity threshold was reached and overrode the rules.",
  rule_match: "The highest-tier matching rule decided; priority breaks ties within a tier.",
  fail_safe_default: "No rule matched, so the fail-safe applies: RHU, never home.",
};

/**
 * Explainability check for the version being edited (Figure 39): type what a
 * patient might write, or pick codes and answers, and see which rule fires and
 * why. It runs the very same `matchSymptoms()` and `evaluate()` the patient's
 * phone runs, against the unsaved content, entirely in the browser. Nothing is
 * sent anywhere and nothing is stored.
 */
export function TestPanel({ content, codes, versionLabel }: { content: RulesetContent; codes: SymptomCodeEntry[]; versionLabel: string }) {
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const bundle: RulesetBundle = useMemo(
    () => ({
      versionLabel,
      symptomCodes: codes.map(({ code, displayName, needsClarification }) => ({ code, displayName, needsClarification })),
      ...content,
    }),
    [content, codes, versionLabel]
  );

  const matches = useMemo(() => matchSymptoms(text, bundle.lexiconTerms), [text, bundle]);
  const fromText = matches.filter((m) => !m.negated).map((m) => m.symptomCode);
  const symptomCodes = [...new Set([...fromText, ...picked])];

  const questionKeys = [...new Set(bundle.clarificationQuestions.filter((q) => symptomCodes.includes(q.symptomCode)).map((q) => q.questionKey))];

  const result = useMemo(() => {
    const clarificationAnswers = Object.entries(answers)
      .filter(([key, answer]) => answer !== "" && questionKeys.includes(key))
      .map(([questionKey, answer]) => ({ questionKey, answer }));
    return evaluate({ symptomCodes, clarificationAnswers }, bundle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundle, symptomCodes.join("|"), JSON.stringify(answers), questionKeys.join("|")]);

  const rule = result.matchedRuleCode ? bundle.rules.find((r) => r.code === result.matchedRuleCode) : undefined;

  return (
    <div className="mc-grid mc-grid-2">
      <Card title="Patient input">
        <div className="mc-stack">
          <TextAreaField
            label="Free text, as a patient would type it"
            value={text}
            onChange={(e) => setText(e.target.value)}
            hint="Matched against this version's lexicon. Test input only — never stored."
          />
          {matches.length > 0 && (
            <p className="mc-small" style={{ margin: 0 }}>
              Lexicon matched:{" "}
              {matches.map((m) => (
                <span key={m.symptomCode} className="mc-badge" style={{ marginRight: 4 }}>
                  {m.negated ? "not " : ""}
                  {m.symptomCode} ← “{m.matchedTerm.term}”
                </span>
              ))}
            </p>
          )}
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend className="mc-small mc-muted" style={{ marginBottom: 6 }}>
              Or tap symptom codes (like the patient's chips)
            </legend>
            <div className="chip-picker">
              {codes.map((c) => (
                <label key={c.code}>
                  <input
                    type="checkbox"
                    checked={picked.includes(c.code)}
                    onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.code] : p.filter((x) => x !== c.code)))}
                  />
                  {c.code}
                </label>
              ))}
            </div>
          </fieldset>
          {questionKeys.map((key) => {
            const question = bundle.clarificationQuestions.find((q) => q.questionKey === key)!;
            return (
              <TextField
                key={key}
                label={`Answer to “${key}” (${question.allowedAnswers.join(" / ")})`}
                value={answers[key] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [key]: e.target.value }))}
              />
            );
          })}
        </div>
      </Card>

      <Card title="Engine result">
        <div className="mc-stack">
          <div>
            <TierBadge tier={result.tier} />
          </div>
          <p style={{ margin: 0 }}>{REASONS[result.reason]}</p>
          {rule && (
            <div>
              <div className="mc-small mc-muted">
                Rule {rule.code} — {rule.name || "unnamed"}
              </div>
            </div>
          )}
          {result.matchedThresholdKey && <p className="mc-small">Threshold: {result.matchedThresholdKey}</p>}
          {result.matchedQuestionKey && <p className="mc-small">Red-flag question: {result.matchedQuestionKey}</p>}
          {symptomCodes.length === 0 && <Banner tone="info">No symptom codes yet. With none, the engine returns the RHU fail-safe.</Banner>}
        </div>
      </Card>
    </div>
  );
}
