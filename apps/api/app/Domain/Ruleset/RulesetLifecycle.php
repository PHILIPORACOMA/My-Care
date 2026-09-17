<?php

namespace App\Domain\Ruleset;

use App\Domain\DomainActionException;
use App\Domain\Audit\Recorder;
use App\Models\RulesetVersion;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Draft → Review → Publish, and rollback (Table 30, Figure 11, UT-007–UT-011).
 *
 * The one place a ruleset version changes state. Controllers call this; they
 * never touch RULESET_VERSION.status themselves.
 *
 * Status changes are audited by the model observer (an `updated` entry whose
 * old_value holds the previous status). Two actions carry provenance the
 * observer cannot see — which version a draft was saved from, and which
 * version a rollback restored — so this service adds one explicit entry for
 * each through Recorder. It is a domain service, not a controller, which is the
 * boundary the audit rule draws.
 */
final class RulesetLifecycle
{
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
     */
    public function publish(RulesetVersion $version, User $by, bool $clinicalReviewConfirmed): RulesetVersion
    {
        if (! $clinicalReviewConfirmed) {
            throw DomainActionException::conflict('Publishing requires confirming that clinical review took place.');
        }

        return DB::transaction(function () use ($version, $by): RulesetVersion {
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

            return $restored;
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
