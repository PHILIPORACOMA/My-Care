<?php

namespace App\Domain\Accounts;

use App\Domain\DomainActionException;
use App\Models\AuditLog;
use App\Models\Barangay;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

/**
 * Sub-admin account management (Figure 38, UT-019).
 *
 * USER (Table 17) has six columns: id, email, password_hash, email_verified_at,
 * role_id, barangay_id. Figure 38 shows a status column and a creation date,
 * and promises the team can "deactivate access instantly". Neither has a
 * column, so without an amendment:
 *
 * **Status lives in password_hash.** Deactivating replaces the digest with a
 * sentinel that is shaped like a bcrypt hash — so Laravel's hasher, which
 * throws on non-bcrypt values, stays quiet — but carries a fixed, recognisable
 * salt and a random tail, so no password can ever match it. This is the
 * long-standing Unix idiom of locking an account by making its password field
 * unmatchable. Because the hash changed, Sanctum's AuthenticateSession
 * middleware (already in the stateful stack) signs out every other session the
 * account holds on its next request: "instantly" in practice. Reactivating
 * means setting a new password.
 *
 * **Creation date comes from the audit log.** Every account creation is
 * recorded by the model observer with a timestamp; the account list reads it
 * back. Accounts seeded without events show no date rather than a made-up one.
 *
 * Figure 38 also labels sub-admins "RHU" or "LGU". ROLE (Table 24) has one
 * sub_admin role shared by both, as the figure's own caption says, and USER has
 * no column to tell them apart — so the console shows "Sub-admin". Recorded as
 * a known gap in docs/BUILD-LOG.md.
 */
final class AccountManager
{
    /** A bcrypt-shaped string: "$2y$10$" + a 22-character salt + 31 characters. */
    private const LOCK_PREFIX = '$2y$10$MyCareAccountDisabled.';

    /**
     * @param  array<string, mixed>  $data  email, password, barangayId
     *
     * @throws DomainActionException
     */
    public function createSubAdmin(array $data): User
    {
        $this->validate($data, [
            'email' => ['required', 'string', 'email', 'max:150', 'unique:users,email'],
            'password' => ['required', 'string', $this->passwordRule()],
            'barangayId' => ['required', 'integer', 'exists:barangays,id'],
        ]);

        return User::create([
            'email' => mb_strtolower($data['email']),
            // Cast 'hashed' on the model: stored as a bcrypt digest.
            'password_hash' => $data['password'],
            'email_verified_at' => null,
            'role_id' => Role::where('name', 'sub_admin')->firstOrFail()->getKey(),
            'barangay_id' => (int) $data['barangayId'],
        ]);
    }

    public function createSuperAdmin(string $email, string $password): User
    {
        $this->validate(['email' => $email, 'password' => $password], [
            'email' => ['required', 'string', 'email', 'max:150', 'unique:users,email'],
            'password' => ['required', 'string', $this->passwordRule()],
        ]);

        return User::create([
            'email' => mb_strtolower($email),
            'password_hash' => $password,
            'email_verified_at' => null,
            'role_id' => Role::where('name', 'super_admin')->firstOrFail()->getKey(),
            'barangay_id' => null,
        ]);
    }

    public function deactivate(User $account, User $actor): User
    {
        if ($account->is($actor)) {
            throw DomainActionException::conflict('You cannot deactivate your own account.');
        }

        if ($this->isDeactivated($account)) {
            return $account;
        }

        // setRawAttributes bypasses the 'hashed' cast (which would reject the
        // sentinel's cost factor) while still firing the model's `updated`
        // event, so the observer audits it — with the digest redacted.
        $account->setRawAttributes(
            ['password_hash' => self::LOCK_PREFIX.Str::random(31)] + $account->getAttributes()
        );
        $account->save();

        return $account->refresh();
    }

    /** @throws DomainActionException */
    public function setPassword(User $account, string $password): User
    {
        $this->validate(['password' => $password], ['password' => ['required', 'string', $this->passwordRule()]]);

        $account->update(['password_hash' => $password]);

        return $account->refresh();
    }

    /** @throws DomainActionException */
    public function reassignBarangay(User $account, int $barangayId): User
    {
        $account->loadMissing('role');

        if ($account->role?->name !== 'sub_admin') {
            throw DomainActionException::conflict('Only a sub-admin is scoped to a barangay.');
        }

        if (! Barangay::whereKey($barangayId)->exists()) {
            throw DomainActionException::invalid(['barangayId' => ['Unknown barangay.']]);
        }

        $account->update(['barangay_id' => $barangayId]);

        return $account->refresh();
    }

    public function isDeactivated(User $account): bool
    {
        return str_starts_with((string) $account->getRawOriginal('password_hash'), self::LOCK_PREFIX);
    }

    /** When the account was created, from the audit trail, or null if unrecorded. */
    public function createdAt(User $account): ?string
    {
        $at = AuditLog::where('target_table', 'users')
            ->where('target_id', $account->getKey())
            ->where('action_type', 'created')
            ->orderBy('id')
            ->value('created_at');

        return $at === null ? null : \Carbon\CarbonImmutable::parse($at, 'UTC')->toIso8601String();
    }

    private function passwordRule(): Password
    {
        // Staff accounts guard surveillance data for a whole barangay.
        return Password::min(12)->letters()->numbers();
    }

    /**
     * @param  array<string, mixed>  $data
     * @param  array<string, mixed>  $rules
     */
    private function validate(array $data, array $rules): void
    {
        $validator = Validator::make($data, $rules);

        if ($validator->fails()) {
            throw DomainActionException::invalid($validator->errors()->toArray());
        }
    }
}
