<?php

namespace App\Domain\Ruleset;

/**
 * Lifecycle states stored in RULESET_VERSION.status (Table 7, VARCHAR(15)).
 *
 * Table 30 names the module "Content Versioning (Draft → Review → Publish)",
 * and Figure 11's admin workflow sends every change through clinical review
 * before it reaches the live application. The states below are that workflow,
 * plus the two a history needs:
 *
 *   draft       editable. Saving it creates a NEW version (UT-010).
 *   superseded  a draft that was saved over. Read-only, kept for history.
 *   in_review   submitted for clinical review. Read-only.
 *   published   the one version devices receive (UT-013). Exactly one at a time.
 *   retired     was published, has been replaced by a later publication or a
 *               rollback. Read-only; sessions recorded under it still replay
 *               against it.
 *
 * Nothing is ever deleted. A past triage result is reconstructible only while
 * the version that produced it still exists (Figure 41).
 */
final class RulesetStatus
{
    public const DRAFT = 'draft';

    public const SUPERSEDED = 'superseded';

    public const IN_REVIEW = 'in_review';

    public const PUBLISHED = 'published';

    public const RETIRED = 'retired';

    public const ALL = [self::DRAFT, self::SUPERSEDED, self::IN_REVIEW, self::PUBLISHED, self::RETIRED];

    /** States whose content has left the author's hands and must not change. */
    public const FROZEN = [self::IN_REVIEW, self::PUBLISHED, self::RETIRED];

    private function __construct()
    {
    }
}
