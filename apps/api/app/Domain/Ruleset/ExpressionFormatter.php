<?php

namespace App\Domain\Ruleset;

/**
 * Renders a rule's conditions as the plain IF / AND / NOT text Figure 39 shows,
 * stored in TRIAGE_RULE.expression (Table 9).
 *
 * The expression is generated, never typed. `rule_conditions` rows are what the
 * engine evaluates; `expression` is only their human-readable mirror. If an
 * author could edit both, the two could disagree, and the explanation a health
 * worker reads would describe a rule that is not the one that fired.
 *
 * Mirrors the engine's left-to-right fold (packages/triage-engine,
 * `ruleMatches`): the first condition's operator is ignored unless it is NOT,
 * and every later condition joins with its own operator. No parentheses are
 * implied, because the engine applies none.
 */
final class ExpressionFormatter
{
    /**
     * @param  list<array<string, mixed>>  $conditions  Contract shape (camelCase).
     */
    public static function format(array $conditions, string $tier): string
    {
        $parts = [];

        foreach (array_values($conditions) as $index => $condition) {
            $operator = $condition['operator'] ?? 'AND';
            $term = self::term($condition);

            if ($index === 0) {
                $parts[] = $operator === 'NOT' ? "NOT {$term}" : $term;

                continue;
            }

            $parts[] = $operator === 'NOT' ? "AND NOT {$term}" : "{$operator} {$term}";
        }

        return 'IF '.implode(' ', $parts)." THEN {$tier}";
    }

    /** @param array<string, mixed> $condition */
    private static function term(array $condition): string
    {
        if (isset($condition['symptomCode'])) {
            return (string) $condition['symptomCode'];
        }

        return sprintf(
            '%s %s %s',
            $condition['attribute'] ?? '?',
            $condition['comparator'] ?? '?',
            $condition['severityThresholdKey'] ?? '?',
        );
    }
}
