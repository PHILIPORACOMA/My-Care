<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data Dictionary Table 19: AUDIT_LOG.
 *
 * Every privileged action: rule publications, account changes, data exports,
 * deployments (Figure 41). Written only by App\Domain\Audit\Recorder, from
 * model observers — never from a controller.
 *
 * AMENDMENT (approved 2026-09-04): `created_at DATETIME NOT NULL` is added to
 * Table 19. The Data Dictionary as written lists no timestamp column at all,
 * which contradicts the manuscript's own description of this screen — Figure
 * 41 states each entry is "stamped with the responsible actor and timestamp".
 * A log that cannot be ordered in time is not an audit trail, and the screen
 * cannot render a column that does not exist. This corrects the Data
 * Dictionary to match prose the manuscript already contains. See
 * docs/adr/0002-phase-3-schema-decisions.md.
 *
 * `new_value` was considered and deliberately not added: the reconstruction
 * claim in Figure 41 is served by the version-scoped ruleset tables, not by a
 * diff stored here, so old_value alone is sufficient.
 *
 * actor_id is nullable (system-initiated actions have no user), but
 * actor_label is not — every entry names a responsible party, even if that is
 * "system" or a deleted account.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('actor_id')->nullable();
            $table->string('actor_label', 50);
            $table->string('action_type', 20);
            $table->string('target_table', 64);
            $table->integer('target_id')->nullable();
            $table->json('old_value')->nullable();
            $table->dateTime('created_at');

            // The audit view is read newest-first, and filtered by target.
            $table->index('created_at');
            $table->index(['target_table', 'target_id']);

            $table->foreign('actor_id')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
