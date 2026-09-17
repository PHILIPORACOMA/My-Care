<?php

namespace Tests\Feature\Api;

use App\Domain\Device\DeviceToken;
use App\Models\Barangay;
use App\Models\ClarificationQuestion;
use App\Models\Device;
use App\Models\LexiconTerm;
use App\Models\RulesetVersion;
use App\Models\SymptomCode;
use App\Models\TriageRule;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Fixture builders for the device-facing API tests.
 *
 * Deliberately explicit rather than factory-driven: the Data Dictionary has no
 * nullable defaults to lean on, and a test that spells out every column is a
 * test that fails loudly when a column changes meaning.
 */
trait ApiTestHelpers
{
    /**
     * Plain device tokens by device id. DEVICE.api_token stores only a prefix
     * and a digest (Domain/Device/DeviceToken), so the plain value a device
     * presents exists nowhere but here once issued.
     *
     * @var array<int, string>
     */
    protected array $deviceTokens = [];

    protected function makeBarangay(string $name = 'Valladolid'): Barangay
    {
        return Barangay::create([
            'name' => $name,
            'city' => 'Carcar City',
            'region' => 'Region VII',
        ]);
    }

    protected function makeDevice(array $overrides = []): Device
    {
        // Created lazily: a default argument is evaluated even when the caller
        // supplies barangay_id, which would insert a second Valladolid and trip
        // the (name, city, region) unique index.
        $overrides['barangay_id'] ??= $this->makeBarangay()->getKey();

        $token = DeviceToken::issue();

        $device = Device::create(array_merge([
            'type' => 'bhw_phone',
            'label' => 'BHW handset',
            'api_token' => $token['stored'],
            'status' => 'active',
            'is_approved' => true,
            'registered_at' => CarbonImmutable::parse('2026-09-01T00:00:00Z'),
            'last_sync_at' => null,
        ], $overrides));

        $this->deviceTokens[$device->getKey()] = $token['plain'];

        return $device;
    }

    protected function plainTokenFor(Device $device): string
    {
        return $this->deviceTokens[$device->getKey()];
    }

    protected function makePublishedVersion(string $label = 'v1-published'): RulesetVersion
    {
        return RulesetVersion::create([
            'label' => $label,
            'status' => 'published',
            'published_at' => CarbonImmutable::parse('2026-09-02T00:00:00Z'),
            'published_by_id' => null,
        ]);
    }

    protected function makeSymptomCode(string $code = 'fever_mild'): SymptomCode
    {
        return SymptomCode::create([
            'code' => $code,
            'display_name' => 'Fever, mild',
            'needs_clarification' => false,
        ]);
    }

    protected function makeRule(RulesetVersion $version, string $code = 'R-001', string $tier = 'home'): TriageRule
    {
        return TriageRule::create([
            'code' => $code,
            'ruleset_version_id' => $version->getKey(),
            'name' => "Rule {$code}",
            'expression' => 'IF fever_mild',
            'outcome_tier' => $tier,
            'priority' => 10,
            'is_active' => true,
        ]);
    }

    protected function makeLexiconTerm(RulesetVersion $version, SymptomCode $code, string $term = 'hilanat'): LexiconTerm
    {
        return LexiconTerm::create([
            'ruleset_version_id' => $version->getKey(),
            'symptom_code_id' => $code->getKey(),
            'language' => 'ceb',
            'term' => $term,
            'is_negation' => false,
        ]);
    }

    protected function makeQuestion(RulesetVersion $version, SymptomCode $code, string $key = 'chest_pain_severity'): ClarificationQuestion
    {
        return ClarificationQuestion::create([
            'ruleset_version_id' => $version->getKey(),
            'symptom_code_id' => $code->getKey(),
            'question_key' => $key,
            'language' => 'ceb',
            'prompt' => 'Unsa ka grabe ang sakit?',
            'answer_type' => 'single_select',
            'allowed_answers' => ['mild', 'severe'],
            'red_flag_answer' => 'severe',
        ]);
    }

    /** A minimal, valid sync payload carrying one session. */
    protected function payload(array $overrides = [], array $sessionOverrides = []): array
    {
        return array_merge([
            'client_batch_uuid' => (string) Str::uuid(),
            'started_at' => '2026-09-10T01:00:00Z',
            'completed_at' => '2026-09-10T01:00:05Z',
            'sessions' => [$this->sessionPayload($sessionOverrides)],
        ], $overrides);
    }

    protected function sessionPayload(array $overrides = []): array
    {
        return array_merge([
            'client_session_uuid' => (string) Str::uuid(),
            'barangay_id' => $this->barangay->getKey(),
            'ruleset_version_label' => $this->version->label,
            'matched_rule_code' => 'R-001',
            'language' => 'ceb',
            'started_at' => '2026-09-10T00:58:00Z',
            'completed_at' => '2026-09-10T00:59:30Z',
            'symptoms' => [
                ['symptom_code' => 'fever_mild', 'negated' => false, 'matched_term' => null],
            ],
            'clarification_answers' => [],
        ], $overrides);
    }

    protected function asDevice(Device $device): array
    {
        return ['Authorization' => 'Bearer '.$this->plainTokenFor($device)];
    }
}
