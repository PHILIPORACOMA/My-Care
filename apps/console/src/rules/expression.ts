import type { RuleCondition, Tier } from "@mycare/ruleset";

/**
 * Live preview of a rule's IF / AND / NOT text while it is being edited.
 *
 * Mirrors apps/api's Domain/Ruleset/ExpressionFormatter exactly — the server
 * regenerates `expression` on every save, so this is only ever a preview, and
 * a test pins the two to the same output for the same conditions.
 */
export function formatExpression(conditions: readonly RuleCondition[], tier: Tier): string {
  const parts = conditions.map((condition, index) => {
    const term =
      condition.symptomCode !== undefined
        ? condition.symptomCode
        : `${condition.attribute ?? "?"} ${condition.comparator ?? "?"} ${condition.severityThresholdKey ?? "?"}`;

    if (index === 0) {
      return condition.operator === "NOT" ? `NOT ${term}` : term;
    }
    return condition.operator === "NOT" ? `AND NOT ${term}` : `${condition.operator} ${term}`;
  });

  return `IF ${parts.join(" ")} THEN ${tier}`;
}
