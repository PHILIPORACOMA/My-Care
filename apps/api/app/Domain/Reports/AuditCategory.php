<?php

namespace App\Domain\Reports;

use App\Models\AuditLog;

/**
 * The category tag Figure 41 shows on each audit entry.
 *
 * AUDIT_LOG has no category column; the category follows from what was
 * touched and how, so it is derived rather than stored — one mapping, used by
 * both the console list and the export.
 */
final class AuditCategory
{
    public const CATEGORIES = ['rules', 'accounts', 'sign-in', 'exports', 'devices', 'reference'];

    private const TABLES = [
        'ruleset_versions' => 'rules',
        'triage_rules' => 'rules',
        'rule_conditions' => 'rules',
        'severity_thresholds' => 'rules',
        'clarification_questions' => 'rules',
        'lexicon_terms' => 'rules',
        'symptom_codes' => 'rules',
        'health_tips' => 'rules',
        'users' => 'accounts',
        'roles' => 'accounts',
        'reports' => 'exports',
        'devices' => 'devices',
        'barangays' => 'reference',
        'facilities' => 'reference',
    ];

    public static function of(AuditLog $entry): string
    {
        if (in_array($entry->action_type, ['login', 'logout', 'login_failed', 'login_throttled'], true)) {
            return 'sign-in';
        }

        return self::TABLES[$entry->target_table] ?? 'other';
    }

    /** @return list<string> tables for a category, or [] for sign-in */
    public static function tables(string $category): array
    {
        return array_keys(array_filter(self::TABLES, fn (string $c): bool => $c === $category));
    }
}
