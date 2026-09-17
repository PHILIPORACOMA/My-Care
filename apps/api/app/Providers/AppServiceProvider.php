<?php

namespace App\Providers;

use App\Models\Barangay;
use App\Models\ClarificationQuestion;
use App\Models\Device;
use App\Models\Facility;
use App\Models\HealthTip;
use App\Models\LexiconTerm;
use App\Models\Report;
use App\Models\Role;
use App\Models\RuleCondition;
use App\Models\RulesetVersion;
use App\Models\SeverityThreshold;
use App\Models\SymptomCode;
use App\Models\TriageRule;
use App\Models\User;
use App\Observers\AuditableObserver;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Models whose changes are recorded in AUDIT_LOG (Figure 41).
     *
     * The list is the set of things a privileged person configures: the ruleset
     * and everything version-scoped under it, the accounts and roles that can
     * change it, the devices allowed to submit data, and the reference data
     * dashboards are read against.
     *
     * Four categories are deliberately absent:
     *
     * - **Patient data** — TRIAGE_SESSION, SESSION_SYMPTOM,
     *   CLARIFICATION_ANSWER. These arrive by the thousand from devices, are
     *   not anybody's privileged decision, and auditing them would both drown
     *   the log Figure 41 describes and duplicate de-identified clinical data
     *   into a second table that more staff can read.
     * - **Sync plumbing** — SYNC_BATCH. Same volume argument; delivery
     *   attempts are already recorded on the batch itself for UT-014.
     * - **Derived data** — AGGREGATE_STAT is recomputed, not decided.
     * - **AUDIT_LOG itself** — observing it would make every write recurse.
     *
     * @var list<class-string>
     */
    private const AUDITED_MODELS = [
        RulesetVersion::class,
        TriageRule::class,
        RuleCondition::class,
        SeverityThreshold::class,
        ClarificationQuestion::class,
        LexiconTerm::class,
        SymptomCode::class,
        HealthTip::class,
        User::class,
        Role::class,
        Device::class,
        Barangay::class,
        Facility::class,
        Report::class,
    ];

    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        foreach (self::AUDITED_MODELS as $model) {
            $model::observe(AuditableObserver::class);
        }

        /*
        | Device self-registration is unauthenticated (ADR-0005), so it is the
        | endpoint most worth abusing: every call mints an approved credential.
        | A health station or a family registers once; ten an hour per IP is
        | generous for real use and tight for a script.
        */
        RateLimiter::for('device-registration', fn (Request $request) => Limit::perHour(10)->by($request->ip()));

        RateLimiter::for('public-reference', fn (Request $request) => Limit::perMinute(60)->by($request->ip()));
    }
}
