<?php

namespace App\Domain\Ruleset;

use App\Domain\DomainActionException;
use App\Models\RulesetVersion;
use App\Models\SymptomCode;
use Illuminate\Support\Facades\DB;

/**
 * Imports a whole RulesetBundle JSON (the packages/ruleset contract) as a new
 * DRAFT version.
 *
 * This is how `packages/ruleset/src/bundle/v1.ts` — the 23 presentations from
 * the Clinical Appraisal Form — gets into the database. Before this existed,
 * `GET /api/v1/ruleset/current` returned 503 on every fresh install.
 *
 * An import always lands as a draft. It still has to go through review and an
 * attested publish (Figure 11): being encoded in the repository is not the
 * same as having passed clinical review, and v1 has not.
 *
 * Symptom codes in the bundle are created if missing. A code that already
 * exists must match exactly; a silent overwrite would change every published
 * version that uses it (see SymptomCodeRegistry).
 */
final class BundleImporter
{
    public function __construct(
        private readonly ContentValidator $validator,
        private readonly VersionWriter $writer,
        private readonly SymptomCodeRegistry $codes,
    ) {
    }

    /**
     * @param  array<string, mixed>  $bundle
     *
     * @throws DomainActionException
     */
    public function import(array $bundle): RulesetVersion
    {
        $symptomCodes = $bundle['symptomCodes'] ?? null;

        if (! is_array($symptomCodes)) {
            throw DomainActionException::invalid(['symptomCodes' => ['A bundle must contain a symptomCodes array.']]);
        }

        $content = array_intersect_key($bundle + RulesetLifecycle::emptyContent(), RulesetLifecycle::emptyContent());

        return DB::transaction(function () use ($symptomCodes, $content): RulesetVersion {
            foreach ($symptomCodes as $i => $code) {
                $this->ensureCode($code, $i);
            }

            $this->validator->validate($content);

            return $this->writer->write($content, RulesetStatus::DRAFT);
        });
    }

    /** @param mixed $code */
    private function ensureCode($code, int $index): void
    {
        if (! is_array($code) || ! isset($code['code'])) {
            throw DomainActionException::invalid(["symptomCodes.{$index}" => ['Each symptom code needs a code.']]);
        }

        $existing = SymptomCode::where('code', $code['code'])->first();

        if ($existing === null) {
            $this->codes->create($code);

            return;
        }

        if ($existing->display_name !== ($code['displayName'] ?? null)
            || (bool) $existing->needs_clarification !== (bool) ($code['needsClarification'] ?? false)) {
            throw DomainActionException::invalid(["symptomCodes.{$index}" => [
                "Symptom code \"{$code['code']}\" already exists with a different display name or clarification flag. "
                .'Existing codes are not overwritten by an import.',
            ]]);
        }
    }
}
