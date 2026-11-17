<?php

namespace App\Domain\Ruleset;

use App\Domain\DomainActionException;
use App\Domain\Audit\Recorder;
use App\Models\AuditLog;
use App\Models\RulesetVersion;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/**
 * Draft → Review → Publish, and rollback (Table 30, Figure 11, UT-007–UT-011).
 *
 * The one place a ruleset version changes state. Controllers call this; they
 * never touch RULESET_VERSION.status themselves.
 *
 * Status changes are audited by the model observer (an `updated` entry whose
 * old_value holds the previous status). Three things carry provenance the
 * observer cannot see — which version a draft was saved from, which version a
 * rollback restored, and who reviewed and approved a published version — so
 * this service adds one explicit entry for each through Recorder. It is a domain service, not a controller, which is the
 * boundary the audit rule draws.
 */
final class RulesetLifecycle
{
    /** AUDIT_LOG.action_type (VARCHAR(20)) of the reviewer record written at publish. */
    public const CLINICAL_REVIEW = 'clinical_review';

    /** The reviewer is free text: a name, given only with that person's consent, or a role. */
    public const MAX_REVIEWER = 100;

    public function __construct(
        private readonly ContentValidator $validator,
        private readonly VersionWriter $writer,
        private readonly BundleAssembler $assembler,
        private readonly Recorder $recorder,
    ) {
    }

    /** Start a new draft, empty or copied from an existing version. */
    public function createDraft(?RulesetVersion $base = null): RulesetVersion
    {
        $content = $base === null ? self::emptyContent() : $this->assembler->content($base);

        $draft = $this->writer->write($content, RulesetStatus::DRAFT);

        if ($base !== null) {
            $this->recorder->record('draft_started', 'ruleset_versions', $draft->getKey(), ['based_on' => $base->label]);
        }

        return $draft;
    }

    /**
     * UT-010: saving a draft writes a NEW draft version and marks the old one
     * superseded. The old one stays retrievable, read-only.
     *
     * @param  array<string, mixed>  $content
     */
    public function saveDraft(RulesetVersion $draft, array $content): RulesetVersion
    {
        $this->validator->validate($content);

        return DB::transaction(function () use ($draft, $content): RulesetVersion {
            $locked = $this->lock($draft);

            if ($locked->status !== RulesetStatus::DRAFT) {
                throw DomainActionException::conflict(
                    "{$locked->label} is {$locked->status}, not a draft. Open the latest draft and save again."
                );
            }

            $next = $this->writer->write($content, RulesetStatus::DRAFT);
            $locked->update(['status' => RulesetStatus::SUPERSEDED]);

            $this->recorder->record('draft_saved', 'ruleset_versions', $next->getKey(), ['based_on' => $locked->label]);

            return $next;
        });
    }

    /** Send a draft for clinical review (Figure 11). Its content is frozen from here. */
    public function submitForReview(RulesetVersion $draft): RulesetVersion
    {
        $this->validator->validate($this->assembler->content($draft), forRelease: true);

        return $this->transition($draft, from: [RulesetStatus::DRAFT], to: RulesetStatus::IN_REVIEW);
    }

    /** Clinical review asked for changes: back to an editable draft. */
    public function returnToDraft(RulesetVersion $version): RulesetVersion
    {
        return $this->transition($version, from: [RulesetStatus::IN_REVIEW], to: RulesetStatus::DRAFT);
    }

    /**
     * UT-011: publish a reviewed version. Devices receive it on their next
     * check (GET /api/v1/ruleset/current); the previously published version is
     * retired, so exactly one version is ever live.
     *
     * `$clinicalReviewConfirmed` is the super-admin's attestation that Figure
     * 11's clinical review happened. The system cannot verify a clinician's
     * sign-off, so it refuses to publish without the attestation and audits who
     * gave it.
     *
     * `$reviewedBy` says who reviewed and approved it: a health worker's name,
     * entered only with their consent, or a role such as "RHU nurse". RULESET_VERSION
     * (Table 7) has no column for it, so it is kept in the audit log, written
     * once at publish and never edited (ADR-0006). Shown in the console only.
     */
    public function publish(RulesetVersion $version, User $by, bool $clinicalReviewConfirmed, string $reviewedBy): RulesetVersion
    {
        if (! $clinicalReviewConfirmed) {
            throw DomainActionException::conflict('Publishing requires confirming that clinical review took place.');
        }

        $reviewedBy = trim($reviewedBy);

        if ($reviewedBy === '' || mb_strlen($reviewedBy) > self::MAX_REVIEWER) {
            throw DomainActionException::invalid(['reviewedBy' => [
                'Say who reviewed and approved this version, as a name or a role, in '.self::MAX_REVIEWER.' characters or fewer.',
            ]]);
        }

        return DB::transaction(function () use ($version, $by, $reviewedBy): RulesetVersion {
            $locked = $this->lock($version);

            if ($locked->status !== RulesetStatus::IN_REVIEW) {
                throw DomainActionException::conflict("Only a version in review can be published; {$locked->label} is {$locked->status}.");
            }

            $this->retireCurrent();

            $locked->update([
                'status' => RulesetStatus::PUBLISHED,
                'published_at' => CarbonImmutable::now('UTC'),
                'published_by_id' => $by->getKey(),
            ]);

            $this->recorder->record(self::CLINICAL_REVIEW, 'ruleset_versions', $locked->getKey(), ['reviewed_by' => $reviewedBy], $by);

            return $locked->refresh();
        });
    }

    /**
     * UT-011: roll back to an earlier published version.
     *
     * The earlier version is not re-activated in place — its published_at is
     * history. Its content is copied into a new version that is published at
     * once (it was already clinically reviewed when first published), so
     * devices see a new label and every session stays attributable to the
     * exact row that produced it.
     */
    public function rollbackTo(RulesetVersion $target, User $by): RulesetVersion
    {
        if ($target->status !== RulesetStatus::RETIRED) {
            throw DomainActionException::conflict('Only a previously published (retired) version can be rolled back to.');
        }

        return DB::transaction(function () use ($target, $by): RulesetVersion {
            $content = $this->assembler->content($target);

            $this->retireCurrent();

            $restored = $this->writer->write(
                $content,
                RulesetStatus::PUBLISHED,
                CarbonImmutable::now('UTC'),
                $by->getKey(),
            );

            $this->recorder->record('rollback', 'ruleset_versions', $restored->getKey(), ['restored_from' => $target->label]);

            // The content was reviewed when it was first published; the restored
            // copy keeps that reviewer, and says where it came from.
            $reviewer = $this->reviewersOf([$target->getKey()])[$target->getKey()] ?? null;
            if ($reviewer !== null) {
                $this->recorder->record(self::CLINICAL_REVIEW, 'ruleset_versions', $restored->getKey(), [
                    'reviewed_by' => $reviewer,
                    'carried_from' => $target->label,
                ]);
            }

            return $restored;
        });
    }

    /**
     * Who reviewed and approved each version, from its CLINICAL_REVIEW audit
     * entry. A version published before reviewers were recorded has none.
     *
     * @param  list<int>  $versionIds
     * @return array<int, string>  version id => reviewer
     */
    public function reviewersOf(array $versionIds): array
    {
        if ($versionIds === []) {
            return [];
        }

        return AuditLog::where('target_table', 'ruleset_versions')
            ->where('action_type', self::CLINICAL_REVIEW)
            ->whereIn('target_id', $versionIds)
            ->orderBy('id')
            ->get()
            ->mapWithKeys(fn (AuditLog $entry): array => [(int) $entry->target_id => (string) ($entry->old_value['reviewed_by'] ?? '')])
            ->filter(fn (string $reviewer): bool => $reviewer !== '')
            ->all();
    }

    /**
     * Delete a draft that was never submitted: a "New draft" clicked by mistake,
     * an import nobody wants, unfinished work (ADR-0006, amended).
     *
     * Only a `draft` can go. A version that was in review, published, retired or
     * saved over (`superseded`) is history that sessions and UT-010 rely on, so
     * it is kept. Phones only ever receive the published version, so deleting a
     * draft changes nothing for them.
     *
     * The rows it held go with it (the database cascades), and those are not
     * individually audited, so the audit entry records what was lost: the label,
     * the version it was based on and how many of each thing it held. The label
     * is then reserved, so it is never handed out again (VersionWriter).
     */
    public function deleteDraft(RulesetVersion $version): void
    {
        DB::transaction(function () use ($version): void {
            $locked = $this->lock($version);

            if ($locked->status !== RulesetStatus::DRAFT) {
                throw DomainActionException::conflict(
                    "{$locked->label} is {$locked->status}. Only a draft can be deleted; a version that was in review, published or saved over is kept as history."
                );
            }

            $locked->loadCount(['rules', 'lexiconTerms', 'severityThresholds', 'clarificationQuestions', 'healthTips']);

            $basedOn = AuditLog::where('target_table', 'ruleset_versions')
                ->where('target_id', $locked->getKey())
                ->whereIn('action_type', ['draft_started', 'draft_saved'])
                ->latest('id')
                ->first()?->old_value['based_on'] ?? null;

            $this->recorder->record('draft_deleted', 'ruleset_versions', $locked->getKey(), [
                'label' => $locked->label,
                'based_on' => $basedOn,
                'held' => [
                    'rules' => $locked->rules_count,
                    'lexiconTerms' => $locked->lexicon_terms_count,
                    'severityThresholds' => $locked->severity_thresholds_count,
                    'clarificationQuestions' => $locked->clarification_questions_count,
                    'healthTips' => $locked->health_tips_count,
                ],
            ]);

            try {
                $locked->delete();
            } catch (QueryException) {
                // A draft is never served to a device, so no session should point
                // at it. The foreign key is the backstop if one ever does.
                throw DomainActionException::conflict("{$locked->label} is referred to by triage sessions, so it cannot be deleted.");
            }
        });
    }

    /** @return array<string, list<mixed>> */
    public static function emptyContent(): array
    {
        return [
            'lexiconTerms' => [],
            'severityThresholds' => [],
            'clarificationQuestions' => [],
            'rules' => [],
            'healthTips' => [],
        ];
    }

    /** @param list<string> $from */
    private function transition(RulesetVersion $version, array $from, string $to): RulesetVersion
    {
        return DB::transaction(function () use ($version, $from, $to): RulesetVersion {
            $locked = $this->lock($version);

            if (! in_array($locked->status, $from, true)) {
                throw DomainActionException::conflict("{$locked->label} is {$locked->status}; it cannot move to {$to}.");
            }

            $locked->update(['status' => $to]);

            return $locked->refresh();
        });
    }

    private function retireCurrent(): void
    {
        RulesetVersion::where('status', RulesetStatus::PUBLISHED)
            ->lockForUpdate()
            ->get()
            ->each(fn (RulesetVersion $v) => $v->update(['status' => RulesetStatus::RETIRED]));
    }

    private function lock(RulesetVersion $version): RulesetVersion
    {
        return RulesetVersion::whereKey($version->getKey())->lockForUpdate()->firstOrFail();
    }
}
