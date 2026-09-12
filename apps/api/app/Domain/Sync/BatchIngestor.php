<?php

namespace App\Domain\Sync;

use App\Models\Barangay;
use App\Models\ClarificationQuestion;
use App\Models\Device;
use App\Models\LexiconTerm;
use App\Models\RulesetVersion;
use App\Models\SymptomCode;
use App\Models\SyncBatch;
use App\Models\TriageRule;
use App\Models\TriageSession;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Ingests one uploaded sync batch (UT-012, UT-015).
 *
 * Two guarantees this class exists to provide:
 *
 * 1. **Idempotency.** A retried upload resolves to the batch that already
 *    exists rather than creating a second one. Double-counting corrupts
 *    surveillance data, and a health worker acting on an inflated cluster
 *    count is the concrete harm. The UNIQUE index on client_batch_uuid is the
 *    real guarantee; the lookup below is the fast path, and the race handler
 *    catches the case where two retries arrive at once.
 *
 * 2. **Atomicity.** A batch is written entirely or not at all. A partial write
 *    would leave SYNC_BATCH.session_count disagreeing with the rows actually
 *    stored, and nothing downstream could tell which number was right.
 *
 * Everything the device sends is resolved against server-side identifiers —
 * symptom codes, rule codes, question keys — rather than trusted as ids. A
 * device that has been offline for weeks may be carrying an older ruleset, so
 * its notion of "rule 14" is not necessarily the server's.
 */
final class BatchIngestor
{
    /**
     * @param  array<string, mixed>  $payload  Already validated by StoreSyncBatchRequest.
     * @return array{result: array<string, mixed>, replayed: bool}
     */
    public function ingest(Device $device, array $payload): array
    {
        $existing = SyncBatch::where('client_batch_uuid', $payload['client_batch_uuid'])->first();

        if ($existing !== null) {
            return ['result' => $this->replay($existing), 'replayed' => true];
        }

        try {
            $batch = DB::transaction(fn (): SyncBatch => $this->store($device, $payload));
        } catch (QueryException $e) {
            // Two retries raced and the other one won. The UNIQUE index did its
            // job; resolve to the batch that landed rather than failing the
            // caller, which would only prompt a third retry.
            if (! $this->isUniqueViolation($e)) {
                throw $e;
            }

            $winner = SyncBatch::where('client_batch_uuid', $payload['client_batch_uuid'])->firstOrFail();

            return ['result' => $this->replay($winner), 'replayed' => true];
        }

        return ['result' => $this->describe($batch, duplicate: false), 'replayed' => false];
    }

    /** @param array<string, mixed> $payload */
    private function store(Device $device, array $payload): SyncBatch
    {
        $sessions = $payload['sessions'];

        $batch = SyncBatch::create([
            'device_id' => $device->getKey(),
            'client_batch_uuid' => $payload['client_batch_uuid'],
            // "Sessions Carried" (Table 22): what the device sent, which is not
            // necessarily what was newly stored — some may already exist from
            // an earlier partial upload.
            'session_count' => count($sessions),
            'status' => 'complete',
            'attempt_count' => 1,
            'error_code' => null,
            'started_at' => $this->utc($payload['started_at']),
            'completed_at' => $this->utc($payload['completed_at'] ?? null),
        ]);

        foreach ($sessions as $index => $session) {
            $this->storeSession($device, $batch, $session, $index);
        }

        $device->forceFill(['last_sync_at' => CarbonImmutable::now('UTC')])->save();

        return $batch;
    }

    /** @param array<string, mixed> $session */
    private function storeSession(Device $device, SyncBatch $batch, array $session, int $index): void
    {
        // A session already stored under an earlier batch keeps its original
        // batch. Re-pointing it here would move it between uploads and make
        // SYNC_BATCH.session_count unreconcilable after the fact.
        if (TriageSession::where('client_session_uuid', $session['client_session_uuid'])->exists()) {
            return;
        }

        $version = $this->resolveVersion($session['ruleset_version_label'], $index);

        $record = TriageSession::create([
            'client_session_uuid' => $session['client_session_uuid'],
            'barangay_id' => $session['barangay_id'],
            'device_id' => $device->getKey(),
            'ruleset_version_id' => $version->getKey(),
            'matched_rule_id' => $this->resolveRuleId($session['matched_rule_code'] ?? null, $version, $index),
            'sync_batch_id' => $batch->getKey(),
            'language' => $session['language'],
            'started_at' => $this->utc($session['started_at']),
            'completed_at' => $this->utc($session['completed_at']),
            'synced_at' => CarbonImmutable::now('UTC'),
        ]);

        foreach ($session['symptoms'] as $symptom) {
            $record->symptoms()->create([
                'symptom_code_id' => $this->resolveSymptomCodeId($symptom['symptom_code'], $index),
                'matched_term_id' => $this->resolveTermId($symptom['matched_term'] ?? null, $version),
                'negated' => $symptom['negated'],
            ]);
        }

        foreach ($session['clarification_answers'] as $answer) {
            $record->clarificationAnswers()->create([
                'clarification_question_id' => $this->resolveQuestionId(
                    $answer['question_key'],
                    $version,
                    $session['language'],
                    $index,
                ),
                'answer' => $answer['answer'],
                'is_red_flag' => $answer['is_red_flag'],
            ]);
        }
    }

    /**
     * An unknown version label is rejected rather than reassigned to the
     * current one. A session attributed to a ruleset that did not produce it
     * breaks the reconstruction claim in Figure 41 — the whole point of
     * recording ruleset_version_id is that a past result can be replayed
     * against the rules actually in force.
     */
    private function resolveVersion(string $label, int $index): RulesetVersion
    {
        $version = RulesetVersion::where('label', $label)->first();

        if ($version === null) {
            $this->reject("sessions.{$index}.ruleset_version_label", "Unknown ruleset version label \"{$label}\".");
        }

        return $version;
    }

    private function resolveRuleId(?string $code, RulesetVersion $version, int $index): ?int
    {
        if ($code === null) {
            return null;
        }

        $rule = TriageRule::where('ruleset_version_id', $version->getKey())
            ->where('code', $code)
            ->first();

        if ($rule === null) {
            $this->reject(
                "sessions.{$index}.matched_rule_code",
                "Rule \"{$code}\" does not exist in ruleset version \"{$version->label}\".",
            );
        }

        return $rule->getKey();
    }

    private function resolveSymptomCodeId(string $code, int $index): int
    {
        $symptom = SymptomCode::where('code', $code)->first();

        if ($symptom === null) {
            $this->reject("sessions.{$index}.symptoms", "Unknown symptom code \"{$code}\".");
        }

        return $symptom->getKey();
    }

    /**
     * A term the server cannot find is dropped to null rather than rejected.
     * matched_term_id is nullable and purely evidential — it records which
     * lexicon entry the on-device matcher fired on. Losing that trace is a
     * smaller harm than discarding the clinical session it belongs to.
     *
     * @param  array<string, string>|null  $term
     */
    private function resolveTermId(?array $term, RulesetVersion $version): ?int
    {
        if ($term === null) {
            return null;
        }

        return LexiconTerm::where('ruleset_version_id', $version->getKey())
            ->where('language', $term['language'])
            ->where('term', $term['term'])
            ->value('id');
    }

    private function resolveQuestionId(string $key, RulesetVersion $version, string $language, int $index): int
    {
        $question = ClarificationQuestion::where('ruleset_version_id', $version->getKey())
            ->where('question_key', $key)
            ->where('language', $language)
            ->first();

        if ($question === null) {
            $this->reject(
                "sessions.{$index}.clarification_answers",
                "Unknown clarification question \"{$key}\" for language \"{$language}\" in version \"{$version->label}\".",
            );
        }

        return $question->getKey();
    }

    /**
     * A replayed batch returns the result the first attempt produced — never a
     * 409. The device cannot distinguish "my upload was lost" from "my
     * acknowledgement was lost", so a retry has to be safe and has to answer
     * the same thing twice.
     *
     * attempt_count is still incremented: it counts delivery attempts, which is
     * exactly what a retry is, and it feeds the sync monitoring screen
     * (UT-014). It is not part of the returned result, so incrementing it does
     * not change the answer.
     *
     * @return array<string, mixed>
     */
    private function replay(SyncBatch $batch): array
    {
        $batch->increment('attempt_count');

        return $this->describe($batch->refresh(), duplicate: true);
    }

    /** @return array<string, mixed> */
    private function describe(SyncBatch $batch, bool $duplicate): array
    {
        return [
            'client_batch_uuid' => $batch->client_batch_uuid,
            'status' => $batch->status,
            'session_count' => $batch->session_count,
            'stored_session_uuids' => $batch->triageSessions()
                ->orderBy('id')
                ->pluck('client_session_uuid')
                ->all(),
            'duplicate' => $duplicate,
        ];
    }

    private function utc(?string $value): ?CarbonImmutable
    {
        return $value === null ? null : CarbonImmutable::parse($value)->setTimezone('UTC');
    }

    private function isUniqueViolation(QueryException $e): bool
    {
        return (string) $e->getCode() === '23000';
    }

    /** @return never */
    private function reject(string $field, string $message): void
    {
        throw ValidationException::withMessages([$field => $message]);
    }
}
