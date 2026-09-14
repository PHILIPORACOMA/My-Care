<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * The device-to-server sync payload (UT-012).
 *
 * This schema is the enforcement point for the project's hardest privacy rule:
 * **raw symptom text never leaves the device.** There is deliberately no field
 * anywhere below that can carry free text a patient typed. A session arrives as
 * resolved symptom codes, a matched lexicon term drawn from the server's own
 * published bundle, and answers chosen from a clarification question's
 * allowed_answers. Because the rules are strict and unknown keys are ignored by
 * validated(), a future client that started sending `symptom_text` would have
 * it silently dropped rather than persisted.
 *
 * Equally, there is no patient identifier of any kind: no name, no age, no
 * contact, no coordinates. Barangay is the finest granularity the system
 * records (RA 10173, anonymous patients).
 */
class StoreSyncBatchRequest extends FormRequest
{
    /** Authorisation is the `device` middleware's job, not this class's. */
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'client_batch_uuid' => ['required', 'uuid'],
            'started_at' => ['required', 'date'],
            'completed_at' => ['nullable', 'date'],

            'sessions' => ['present', 'array', 'max:500'],

            'sessions.*.client_session_uuid' => ['required', 'uuid'],
            'sessions.*.barangay_id' => ['required', 'integer', 'exists:barangays,id'],
            'sessions.*.ruleset_version_label' => ['required', 'string', 'max:20'],
            'sessions.*.matched_rule_code' => ['nullable', 'string', 'max:20'],
            'sessions.*.language' => ['required', 'string', 'max:5'],
            'sessions.*.started_at' => ['required', 'date'],
            // Table 13 types completed_at as Required = Yes: only completed
            // sessions are ever stored, so an in-flight one cannot be synced.
            'sessions.*.completed_at' => ['required', 'date'],

            'sessions.*.symptoms' => ['present', 'array', 'max:50'],
            'sessions.*.symptoms.*.symptom_code' => ['required', 'string', 'max:50'],
            'sessions.*.symptoms.*.negated' => ['required', 'boolean'],
            // The matched lexicon term is bundle vocabulary the server itself
            // published, identified by its surface form and language — never
            // the patient's own words.
            'sessions.*.symptoms.*.matched_term' => ['nullable', 'array'],
            'sessions.*.symptoms.*.matched_term.term' => ['required_with:sessions.*.symptoms.*.matched_term', 'string', 'max:100'],
            'sessions.*.symptoms.*.matched_term.language' => ['required_with:sessions.*.symptoms.*.matched_term', 'string', 'max:5'],

            'sessions.*.clarification_answers' => ['present', 'array', 'max:50'],
            'sessions.*.clarification_answers.*.question_key' => ['required', 'string', 'max:50'],
            'sessions.*.clarification_answers.*.answer' => ['required', 'string', 'max:50'],
            'sessions.*.clarification_answers.*.is_red_flag' => ['required', 'boolean'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'sessions.*.completed_at.required' =>
                'Only completed sessions can be synced; TRIAGE_SESSION.completed_at is NOT NULL (Table 13).',
        ];
    }
}
