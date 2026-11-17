import type { RulesetContent, SymptomCodeEntry } from "@mycare/api-client";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { RulesEditor } from "./editors";
import { formatExpression } from "./expression";
import { TestPanel } from "./TestPanel";

/* Fixture content — test scaffolding, not clinical content. */
const codes: SymptomCodeEntry[] = [
  { code: "code_a", displayName: "Fixture A", needsClarification: false, locked: false },
  { code: "code_b", displayName: "Fixture B", needsClarification: false, locked: false },
];

const content: RulesetContent = {
  lexiconTerms: [{ symptomCode: "code_a", language: "ceb", term: "fixtureword", isNegation: false }],
  severityThresholds: [],
  clarificationQuestions: [],
  rules: [
    {
      code: "R-001",
      name: "Fixture",
      expression: "",
      conditions: [
        { symptomCode: "code_a", operator: "AND" },
        { symptomCode: "code_b", operator: "NOT" },
      ],
      outcomeTier: "emergency",
      priority: 1,
      isActive: true,
    },
  ],
  healthTips: [],
};

describe("formatExpression", () => {
  it("matches the server's ExpressionFormatter output", () => {
    // The same strings RulesetLifecycleTest asserts for apps/api.
    expect(formatExpression([{ symptomCode: "code_a", operator: "AND" }, { attribute: "fixture_score", comparator: ">=", severityThresholdKey: "fixture_score", operator: "AND" }], "rhu")).toBe(
      "IF code_a AND fixture_score >= fixture_score THEN rhu"
    );
    expect(formatExpression([{ symptomCode: "code_b", operator: "NOT" }, { symptomCode: "code_a", operator: "AND" }], "rhu")).toBe(
      "IF NOT code_b AND code_a THEN rhu"
    );
  });
});

function Harness() {
  const [value, setValue] = useState(content);
  return <RulesEditor content={value} onChange={setValue} codes={codes} readOnly={false} errorFor={() => undefined} />;
}

describe("RulesEditor", () => {
  it("reorders conditions and updates the expression the engine will evaluate", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Rule expression")).toHaveTextContent("IF code_a AND NOT code_b THEN emergency");

    fireEvent.click(screen.getAllByRole("button", { name: "Move condition down" })[0]!);

    expect(screen.getByLabelText("Rule expression")).toHaveTextContent("IF NOT code_b AND code_a THEN emergency");
  });

  it("is read-only for a version that is not a draft", () => {
    render(<RulesEditor content={content} onChange={() => {}} codes={codes} readOnly errorFor={() => undefined} />);
    expect(screen.queryByRole("button", { name: "Add rule" })).toBeNull();
    expect(screen.getAllByLabelText("Code")[0]).toBeDisabled();
  });
});

describe("TestPanel", () => {
  it("runs the real matcher and engine on unsaved content", () => {
    render(<TestPanel content={content} codes={codes} versionLabel="v9" />);

    expect(screen.getByText(/fail-safe applies/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Free text/), { target: { value: "fixtureword" } });

    expect(screen.getByText("Emergency referral")).toBeInTheDocument();
    expect(screen.getByText(/Rule R-001/)).toBeInTheDocument();
  });

  // Fixture follow-up shaped like v2's Part C ones: a home answer, an rhu rule on
  // "!= home answer", and a red flag. English first, as the API serves it.
  const followUp: RulesetContent = {
    lexiconTerms: [],
    severityThresholds: [{ key: "q_home", label: "home answer", value: "Small", tier: "rhu", isOverride: false }],
    clarificationQuestions: [
      { questionKey: "q", symptomCode: "code_a", language: "en", prompt: "How big is it?", answerType: "single_select", allowedAnswers: ["Small", "Big", "Bleeding"], redFlagAnswer: "Bleeding" },
      { questionKey: "q", symptomCode: "code_a", language: "ceb", prompt: "Unsa kadako?", answerType: "single_select", allowedAnswers: ["Gamay", "Dako", "Nagdugo"], redFlagAnswer: "Nagdugo" },
    ],
    rules: [
      { code: "R-001", name: "Fixture home", expression: "", conditions: [{ symptomCode: "code_a", operator: "AND" }], outcomeTier: "home", priority: 1, isActive: true },
      {
        code: "R-002",
        name: "Fixture rhu",
        expression: "",
        conditions: [
          { symptomCode: "code_a", operator: "AND" },
          { attribute: "q", comparator: "!=", severityThresholdKey: "q_home", operator: "AND" },
        ],
        outcomeTier: "rhu",
        priority: 2,
        isActive: true,
      },
    ],
    healthTips: [],
  };

  it("offers a follow-up's answers as a choice and sends the exact answer the phone would", () => {
    render(<TestPanel content={followUp} codes={codes} versionLabel="v9" />);
    fireEvent.click(screen.getByLabelText("code_a"));

    // The field's <label> wraps the select, so its text runs on into the options.
    const question = screen.getByLabelText(/^How big is it\?/);
    expect(question).toHaveValue("");
    expect(screen.getByRole("option", { name: "Big (Dako)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Bleeding (Nagdugo) — red flag: emergency" })).toBeInTheDocument();

    // Not answered: the base rule decides, as on the phone.
    expect(screen.getByText(/Rule R-001/)).toBeInTheDocument();

    fireEvent.change(question, { target: { value: "Small" } });
    expect(screen.getByText(/Rule R-001/)).toBeInTheDocument();

    fireEvent.change(question, { target: { value: "Big" } });
    expect(screen.getByText(/Rule R-002/)).toBeInTheDocument();

    fireEvent.change(question, { target: { value: "Bleeding" } });
    expect(screen.getByText("Emergency referral")).toBeInTheDocument();
    expect(screen.getByText(/Red-flag question: q/)).toBeInTheDocument();
  });
});
