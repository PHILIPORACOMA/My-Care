import type {
  ClarificationQuestion,
  Comparator,
  ConditionOperator,
  HealthTip,
  LanguageCode,
  LexiconTerm,
  RuleCondition,
  SeverityThreshold,
  Tier,
  TriageRule,
} from "@mycare/ruleset";
import type { RulesetContent, SymptomCodeEntry } from "@mycare/api-client";
import { Button, Checkbox, EmptyState, SelectField, TextAreaField, TextField, TIER_LABELS } from "@mycare/ui";
import { useMemo, useState } from "react";
import { formatExpression } from "./expression";

export interface EditorProps {
  content: RulesetContent;
  onChange: (content: RulesetContent) => void;
  codes: SymptomCodeEntry[];
  readOnly: boolean;
  errorFor: (path: string) => string | undefined;
}

const TIERS: Tier[] = ["home", "rhu", "emergency"];
const LANGUAGES: { value: LanguageCode; label: string }[] = [
  { value: "ceb", label: "Cebuano" },
  { value: "tl", label: "Tagalog" },
  { value: "en", label: "English" },
];
const OPERATORS: ConditionOperator[] = ["AND", "OR", "NOT"];
const COMPARATORS: Comparator[] = [">=", ">", "=", "!=", "<", "<="];

function replaceAt<T>(list: T[], index: number, value: T): T[] {
  return list.map((item, i) => (i === index ? value : item));
}

function removeAt<T>(list: T[], index: number): T[] {
  return list.filter((_, i) => i !== index);
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item!);
  return copy;
}

function CodeOptions({ codes }: { codes: SymptomCodeEntry[] }) {
  return (
    <>
      <option value="">Choose a symptom code</option>
      {codes.map((c) => (
        <option key={c.code} value={c.code}>
          {c.code} — {c.displayName}
        </option>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ rules */

/**
 * Rules as IF / AND / NOT conditions that resolve to a tier (Figure 39,
 * UT-007). Condition order matters — each operator joins the condition to the
 * ones before it — so conditions can be moved, and the expression preview shows
 * exactly what the engine will evaluate.
 */
export function RulesEditor({ content, onChange, codes, readOnly, errorFor }: EditorProps) {
  const rules = content.rules;
  const setRules = (next: TriageRule[]) => onChange({ ...content, rules: next });

  const addRule = () => {
    const used = new Set(rules.map((r) => r.code));
    let n = rules.length + 1;
    while (used.has(`R-${String(n).padStart(3, "0")}`)) n++;
    setRules([
      ...rules,
      {
        code: `R-${String(n).padStart(3, "0")}`,
        name: "",
        expression: "",
        conditions: [{ symptomCode: "", operator: "AND" }],
        outcomeTier: "rhu",
        priority: rules.length + 1,
        isActive: true,
      },
    ]);
  };

  if (rules.length === 0 && readOnly) {
    return <EmptyState>This version has no rules.</EmptyState>;
  }

  return (
    <div className="mc-stack">
      {rules.map((rule, i) => (
        <RuleCard
          key={i}
          rule={rule}
          index={i}
          codes={codes}
          thresholds={content.severityThresholds}
          readOnly={readOnly}
          errorFor={errorFor}
          onChange={(next) => setRules(replaceAt(rules, i, next))}
          onRemove={() => setRules(removeAt(rules, i))}
        />
      ))}
      {!readOnly && (
        <div>
          <Button variant="secondary" onClick={addRule}>
            Add rule
          </Button>
        </div>
      )}
    </div>
  );
}

function RuleCard(props: {
  rule: TriageRule;
  index: number;
  codes: SymptomCodeEntry[];
  thresholds: SeverityThreshold[];
  readOnly: boolean;
  errorFor: (path: string) => string | undefined;
  onChange: (rule: TriageRule) => void;
  onRemove: () => void;
}) {
  const { rule, index, readOnly, errorFor } = props;
  const base = `rules.${index}`;
  const set = (changes: Partial<TriageRule>) => props.onChange({ ...rule, ...changes });
  const setConditions = (conditions: RuleCondition[]) => set({ conditions });

  return (
    <div className="rule-card">
      <div className="rule-head">
        <TextField label="Code" value={rule.code} disabled={readOnly} error={errorFor(`${base}.code`)} onChange={(e) => set({ code: e.target.value })} />
        <TextField label="Name" value={rule.name} disabled={readOnly} error={errorFor(`${base}.name`)} onChange={(e) => set({ name: e.target.value })} />
        <SelectField label="Tier" value={rule.outcomeTier} disabled={readOnly} onChange={(e) => set({ outcomeTier: e.target.value as Tier })}>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABELS[t]}
            </option>
          ))}
        </SelectField>
        <TextField
          label="Priority"
          type="number"
          min={0}
          value={rule.priority}
          disabled={readOnly}
          hint="Lower wins a tie"
          onChange={(e) => set({ priority: Number(e.target.value) })}
        />
        <div className="mc-row mc-pb-2">
          <Checkbox checked={rule.isActive} disabled={readOnly} onChange={(isActive) => set({ isActive })}>
            Active
          </Checkbox>
          {!readOnly && (
            <Button size="sm" variant="ghost" onClick={props.onRemove} aria-label={`Remove rule ${rule.code}`}>
              Remove
            </Button>
          )}
        </div>
      </div>

      {rule.conditions.map((condition, j) => (
        <ConditionRow
          key={j}
          condition={condition}
          first={j === 0}
          path={`${base}.conditions.${j}`}
          codes={props.codes}
          thresholds={props.thresholds}
          readOnly={readOnly}
          errorFor={errorFor}
          canMoveUp={j > 0}
          canMoveDown={j < rule.conditions.length - 1}
          onChange={(next) => setConditions(replaceAt(rule.conditions, j, next))}
          onMove={(delta) => setConditions(move(rule.conditions, j, j + delta))}
          onRemove={() => setConditions(removeAt(rule.conditions, j))}
        />
      ))}
      {errorFor(`${base}.conditions`) && <small className="mc-field-error">{errorFor(`${base}.conditions`)}</small>}

      {!readOnly && (
        <div className="mc-row">
          <Button size="sm" variant="secondary" onClick={() => setConditions([...rule.conditions, { symptomCode: "", operator: "AND" }])}>
            Add symptom condition
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={props.thresholds.length === 0}
            title={props.thresholds.length === 0 ? "Add a severity threshold first" : undefined}
            onClick={() =>
              setConditions([
                ...rule.conditions,
                { attribute: props.thresholds[0]?.key ?? "", comparator: ">=", severityThresholdKey: props.thresholds[0]?.key ?? "", operator: "AND" },
              ])
            }
          >
            Add threshold condition
          </Button>
        </div>
      )}

      <div className="expression" aria-label="Rule expression">
        {formatExpression(rule.conditions, rule.outcomeTier)}
      </div>
    </div>
  );
}

function ConditionRow(props: {
  condition: RuleCondition;
  first: boolean;
  path: string;
  codes: SymptomCodeEntry[];
  thresholds: SeverityThreshold[];
  readOnly: boolean;
  errorFor: (path: string) => string | undefined;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onChange: (c: RuleCondition) => void;
  onMove: (delta: number) => void;
  onRemove: () => void;
}) {
  const { condition, readOnly } = props;
  const isSymptom = condition.symptomCode !== undefined;
  const conditionError = props.errorFor(props.path);

  return (
    <div>
      <div className="condition-row">
        <SelectField
          label={props.first ? "Start" : "Join"}
          value={condition.operator}
          disabled={readOnly}
          onChange={(e) => props.onChange({ ...condition, operator: e.target.value as ConditionOperator })}
        >
          {OPERATORS.map((op) => (
            <option key={op} value={op}>
              {props.first && op !== "NOT" ? "IF" : op}
            </option>
          ))}
        </SelectField>
        <span className="mc-small mc-muted mc-pb-2">
          {isSymptom ? "symptom" : "threshold"}
        </span>
        {isSymptom ? (
          <SelectField
            label="Symptom code"
            value={condition.symptomCode}
            disabled={readOnly}
            error={props.errorFor(`${props.path}.symptomCode`)}
            onChange={(e) => props.onChange({ symptomCode: e.target.value, operator: condition.operator })}
          >
            <CodeOptions codes={props.codes} />
          </SelectField>
        ) : (
          <div className="mc-grid" style={{ gridTemplateColumns: "1fr 80px 1fr" }}>
            <TextField
              label="Attribute (question key)"
              value={condition.attribute ?? ""}
              disabled={readOnly}
              onChange={(e) => props.onChange({ ...condition, attribute: e.target.value })}
            />
            <SelectField
              label="Is"
              value={condition.comparator ?? ">="}
              disabled={readOnly}
              onChange={(e) => props.onChange({ ...condition, comparator: e.target.value as Comparator })}
            >
              {COMPARATORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Threshold"
              value={condition.severityThresholdKey ?? ""}
              disabled={readOnly}
              error={props.errorFor(`${props.path}.severityThresholdKey`)}
              onChange={(e) => props.onChange({ ...condition, severityThresholdKey: e.target.value })}
            >
              {props.thresholds.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.key} ({t.value})
                </option>
              ))}
            </SelectField>
          </div>
        )}
        {!readOnly && (
          <div className="mc-row mc-pb-2">
            <Button size="sm" variant="ghost" disabled={!props.canMoveUp} onClick={() => props.onMove(-1)} aria-label="Move condition up">
              ↑
            </Button>
            <Button size="sm" variant="ghost" disabled={!props.canMoveDown} onClick={() => props.onMove(1)} aria-label="Move condition down">
              ↓
            </Button>
            <Button size="sm" variant="ghost" onClick={props.onRemove} aria-label="Remove condition">
              ✕
            </Button>
          </div>
        )}
      </div>
      {conditionError && <small className="mc-field-error">{conditionError}</small>}
    </div>
  );
}

/* ------------------------------------------------------------- thresholds */

/** Severity thresholds and red-flag overrides (UT-009). */
export function ThresholdsEditor({ content, onChange, readOnly, errorFor }: EditorProps) {
  const thresholds = content.severityThresholds;
  const set = (next: SeverityThreshold[]) => onChange({ ...content, severityThresholds: next });

  return (
    <div className="mc-stack">
      <p className="mc-muted mc-small mc-flush">
        A threshold is compared with a clarification answer whose question key matches. Marked as a <strong>red-flag override</strong>, reaching it
        forces its tier ahead of every rule.
      </p>
      {thresholds.length === 0 && <EmptyState>No thresholds.</EmptyState>}
      {thresholds.map((t, i) => (
        <div key={i} className="rule-card">
          <div className="editor-row" style={{ gridTemplateColumns: "1fr 1.4fr 100px 170px auto" }}>
            <TextField label="Key" value={t.key} disabled={readOnly} error={errorFor(`severityThresholds.${i}.key`)} onChange={(e) => set(replaceAt(thresholds, i, { ...t, key: e.target.value }))} />
            <TextField label="Label" value={t.label} disabled={readOnly} error={errorFor(`severityThresholds.${i}.label`)} onChange={(e) => set(replaceAt(thresholds, i, { ...t, label: e.target.value }))} />
            <TextField label="Cut-off" value={t.value} disabled={readOnly} error={errorFor(`severityThresholds.${i}.value`)} onChange={(e) => set(replaceAt(thresholds, i, { ...t, value: e.target.value }))} />
            <SelectField label="Tier" value={t.tier} disabled={readOnly} onChange={(e) => set(replaceAt(thresholds, i, { ...t, tier: e.target.value as Tier }))}>
              {TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {TIER_LABELS[tier]}
                </option>
              ))}
            </SelectField>
            <div className="mc-row mc-pb-2">
              <Checkbox checked={t.isOverride} disabled={readOnly} onChange={(isOverride) => set(replaceAt(thresholds, i, { ...t, isOverride }))}>
                Red-flag override
              </Checkbox>
              {!readOnly && (
                <Button size="sm" variant="ghost" onClick={() => set(removeAt(thresholds, i))}>
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>
      ))}
      {!readOnly && (
        <div>
          <Button variant="secondary" onClick={() => set([...thresholds, { key: "", label: "", value: "", tier: "emergency", isOverride: false }])}>
            Add threshold
          </Button>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- questions */

/**
 * Clarification questions (Figure 23). Every language version of a question
 * key must list the same number of answers with the red-flag answer in the same
 * position: the device submits the answer by position (ADR-0006).
 */
export function QuestionsEditor({ content, onChange, codes, readOnly, errorFor }: EditorProps) {
  const questions = content.clarificationQuestions;
  const set = (next: ClarificationQuestion[]) => onChange({ ...content, clarificationQuestions: next });

  return (
    <div className="mc-stack">
      <p className="mc-muted mc-small mc-flush">
        Asked when a matched symptom needs clarification. The key doubles as the attribute a threshold condition reads. Give each language its own
        entry with the same key; keep answers in the same order across languages.
      </p>
      {questions.length === 0 && <EmptyState>No clarification questions.</EmptyState>}
      {questions.map((q, i) => {
        const base = `clarificationQuestions.${i}`;
        return (
          <div key={i} className="rule-card">
            <div className="editor-row" style={{ gridTemplateColumns: "1fr 1.3fr 140px auto" }}>
              <TextField label="Question key" value={q.questionKey} disabled={readOnly} error={errorFor(`${base}.questionKey`)} onChange={(e) => set(replaceAt(questions, i, { ...q, questionKey: e.target.value }))} />
              <SelectField label="Symptom" value={q.symptomCode} disabled={readOnly} error={errorFor(`${base}.symptomCode`)} onChange={(e) => set(replaceAt(questions, i, { ...q, symptomCode: e.target.value }))}>
                <CodeOptions codes={codes} />
              </SelectField>
              <SelectField label="Language" value={q.language} disabled={readOnly} error={errorFor(`${base}.language`)} onChange={(e) => set(replaceAt(questions, i, { ...q, language: e.target.value as LanguageCode }))}>
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </SelectField>
              {!readOnly && (
                <Button size="sm" variant="ghost" onClick={() => set(removeAt(questions, i))} className="mc-mb-1">
                  Remove
                </Button>
              )}
            </div>
            <TextAreaField label="Prompt shown to the patient" value={q.prompt} disabled={readOnly} error={errorFor(`${base}.prompt`)} onChange={(e) => set(replaceAt(questions, i, { ...q, prompt: e.target.value }))} />
            <div className="editor-row" style={{ gridTemplateColumns: "2fr 1fr" }}>
              <TextField
                label="Answers, in order, separated by |"
                value={q.allowedAnswers.join(" | ")}
                disabled={readOnly}
                error={errorFor(`${base}.allowedAnswers`)}
                onChange={(e) =>
                  set(replaceAt(questions, i, { ...q, allowedAnswers: e.target.value.split("|").map((a) => a.trim()) }))
                }
              />
              <SelectField
                label="Red-flag answer"
                value={q.redFlagAnswer ?? ""}
                disabled={readOnly}
                error={errorFor(`${base}.redFlagAnswer`)}
                onChange={(e) => set(replaceAt(questions, i, { ...q, redFlagAnswer: e.target.value || undefined }))}
              >
                <option value="">None</option>
                {q.allowedAnswers.filter(Boolean).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </SelectField>
            </div>
          </div>
        );
      })}
      {!readOnly && (
        <div>
          <Button
            variant="secondary"
            onClick={() =>
              set([
                ...questions,
                { questionKey: "", symptomCode: "", language: "ceb", prompt: "", answerType: "single_select", allowedAnswers: ["", ""] },
              ])
            }
          >
            Add question
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- lexicon */

/**
 * The symptom lexicon (UT-008): Cebuano, Tagalog and English surface forms
 * mapped to symptom codes. Negation terms ("walay hilanat") mark a symptom as
 * explicitly absent. Every word here must come from the team's clinical
 * appraisal — the software adds none of its own.
 */
export function LexiconEditor({ content, onChange, codes, readOnly, errorFor }: EditorProps) {
  const terms = content.lexiconTerms;
  const set = (next: LexiconTerm[]) => onChange({ ...content, lexiconTerms: next });
  const [filter, setFilter] = useState("");

  const visible = useMemo(
    () =>
      terms
        .map((term, index) => ({ term, index }))
        .filter(({ term }) => !filter || term.symptomCode.includes(filter) || term.term.toLowerCase().includes(filter.toLowerCase())),
    [terms, filter]
  );

  return (
    <div className="mc-stack">
      <div className="mc-row mc-row-between">
        <TextField label="Filter" placeholder="Code or word" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <span className="mc-small mc-muted">{terms.length} terms</span>
      </div>
      {visible.length === 0 && <EmptyState>{terms.length === 0 ? "The lexicon is empty. Patients can still use symptom chips." : "No terms match."}</EmptyState>}
      {visible.map(({ term, index }) => (
        <div key={index} className="editor-row" style={{ gridTemplateColumns: "1.3fr 130px 1.3fr 150px auto" }}>
          <SelectField label="Symptom" value={term.symptomCode} disabled={readOnly} error={errorFor(`lexiconTerms.${index}.symptomCode`)} onChange={(e) => set(replaceAt(terms, index, { ...term, symptomCode: e.target.value }))}>
            <CodeOptions codes={codes} />
          </SelectField>
          <SelectField label="Language" value={term.language} disabled={readOnly} onChange={(e) => set(replaceAt(terms, index, { ...term, language: e.target.value as LanguageCode }))}>
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </SelectField>
          <TextField label="Word or phrase" value={term.term} disabled={readOnly} error={errorFor(`lexiconTerms.${index}.term`)} onChange={(e) => set(replaceAt(terms, index, { ...term, term: e.target.value }))} />
          <div className="mc-pb-2">
            <Checkbox checked={term.isNegation} disabled={readOnly} onChange={(isNegation) => set(replaceAt(terms, index, { ...term, isNegation }))}>
              Negation (symptom absent)
            </Checkbox>
          </div>
          {!readOnly ? (
            <Button size="sm" variant="ghost" onClick={() => set(removeAt(terms, index))} className="mc-mb-1">
              Remove
            </Button>
          ) : (
            <span />
          )}
        </div>
      ))}
      {!readOnly && (
        <div>
          <Button variant="secondary" onClick={() => set([...terms, { symptomCode: filter && codes.some((c) => c.code === filter) ? filter : "", language: "ceb", term: "", isNegation: false }])}>
            Add term
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ health tips */

/** Health tips shown with a result (Figure 28). Medical content: review before publishing. */
export function TipsEditor({ content, onChange, codes, readOnly, errorFor }: EditorProps) {
  const tips = content.healthTips;
  const set = (next: HealthTip[]) => onChange({ ...content, healthTips: next });

  return (
    <div className="mc-stack">
      {tips.length === 0 && <EmptyState>No health tips. The result screen still shows its tier guidance and disclaimer.</EmptyState>}
      {tips.map((tip, i) => {
        const base = `healthTips.${i}`;
        return (
          <div key={i} className="rule-card">
            <div className="editor-row" style={{ gridTemplateColumns: "170px 1.3fr 140px 100px auto" }}>
              <SelectField label="Tier" value={tip.outcomeTier} disabled={readOnly} onChange={(e) => set(replaceAt(tips, i, { ...tip, outcomeTier: e.target.value as Tier }))}>
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {TIER_LABELS[t]}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Symptom (optional)" value={tip.symptomCode ?? ""} disabled={readOnly} error={errorFor(`${base}.symptomCode`)} onChange={(e) => set(replaceAt(tips, i, { ...tip, symptomCode: e.target.value || undefined }))}>
                <option value="">Any symptom in this tier</option>
                {codes.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Language" value={tip.language} disabled={readOnly} onChange={(e) => set(replaceAt(tips, i, { ...tip, language: e.target.value as LanguageCode }))}>
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </SelectField>
              <TextField label="Order" type="number" min={0} value={tip.displayOrder} disabled={readOnly} onChange={(e) => set(replaceAt(tips, i, { ...tip, displayOrder: Number(e.target.value) }))} />
              {!readOnly && (
                <Button size="sm" variant="ghost" onClick={() => set(removeAt(tips, i))} className="mc-mb-1">
                  Remove
                </Button>
              )}
            </div>
            <TextField label="Title" value={tip.title} disabled={readOnly} error={errorFor(`${base}.title`)} onChange={(e) => set(replaceAt(tips, i, { ...tip, title: e.target.value }))} />
            <TextAreaField label="Guidance" value={tip.body} disabled={readOnly} error={errorFor(`${base}.body`)} onChange={(e) => set(replaceAt(tips, i, { ...tip, body: e.target.value }))} />
          </div>
        );
      })}
      {!readOnly && (
        <div>
          <Button variant="secondary" onClick={() => set([...tips, { outcomeTier: "home", language: "ceb", title: "", body: "", displayOrder: tips.length + 1 }])}>
            Add health tip
          </Button>
        </div>
      )}
    </div>
  );
}
