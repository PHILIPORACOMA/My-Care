# ADR-0004: Staff authentication

## Status

Accepted 2026-09-14. Implemented in `apps/api`, verified against MySQL 8 —
**Pest 88 passed, 309 assertions**, and `migrate:fresh --seed` still produces
exactly **21 tables** (the 20 Data Dictionary entities plus Laravel's
`migrations`).

## Context

Staff authentication was the last open blocker in Phase 3 and the thing holding
up Phases 4 and 7. `docs/STATUS.md` had carried it since the schema landed:

> **Staff auth has no token table.** No `personal_access_tokens` in the
> dictionary. Phase 4 must choose stateless JWT (no table, no amendment) or
> Sanctum (+1 table, amendment). Not decided.

That framing turned out to be slightly wrong, and the correction is the whole
substance of this ADR: **"Sanctum" is not one decision.** Sanctum ships two
independent authentication modes, and only one of them needs a table.

- **API token mode** issues bearer tokens from `createToken()` and stores them
  in `personal_access_tokens`. That is a 21st entity, which means amending the
  Data Dictionary *and* adding a relationship to `USER` in Figure 42's ERD.
- **SPA mode** authenticates first-party single-page apps with an ordinary
  Laravel session cookie plus CSRF. No tokens are issued. **No table.**

`apps/portal` and `apps/console` are first-party React SPAs built in this same
monorepo, which is precisely the case SPA mode exists for.

## Decision

**Sanctum in SPA (cookie) mode.** No manuscript amendment is needed, and the
schema stays equal to the 20 Data Dictionary entities.

### Why not API tokens

The amendment was affordable, so this was not a cost-avoidance decision. Two
things decided it:

1. **Nothing needed tokens.** Both staff clients are browser SPAs on the same
   deployment. Tokens would buy independence from deployment topology that
   nothing is asking for.
2. **A token table stores credentials at rest.** SPA mode's only persisted
   secret remains `USER.password_hash`. Fewer places for a credential to live
   is the better default for a system whose privacy posture is a graded part of
   the defence.

### What this rests on

**Cookie auth requires the SPAs and the API to share a registrable domain** —
`api.mycare.example` and `portal.mycare.example` with
`SESSION_DOMAIN=.mycare.example`. Phase 9 has not chosen a deployment topology
yet. **If deployment puts the portal on an unrelated domain, this decision has
to be revisited**, and the fallback is API token mode plus the amendment this
ADR avoided. That condition is the one thing to carry forward.

### Sanctum 4.x does not create the table by itself

Worth recording, because the original plan for this work was wrong about it.
`Sanctum::ignoreMigrations()` does not exist in Sanctum 4.x. Reading
`SanctumServiceProvider`, the package only calls `publishesMigrations()` — it
never calls `loadMigrationsFrom()`. So the token table appears **only** if
somebody runs `php artisan install:api` or
`vendor:publish --tag=sanctum-migrations`.

That makes the real protection a test, not a config call. `SchemaTest` now
asserts `personal_access_tokens` is absent alongside `cache`, `jobs`,
`sessions` and the rest. If a future session runs `install:api` out of habit,
the build fails and says why.

Only the config was published: `php artisan vendor:publish --tag=sanctum-config`.

### Devices are untouched

Devices keep `AuthenticateDevice` on `DEVICE.api_token` (ADR-0003). A device is
not an account: it has no role, no barangay scope of its own, and must never
reach a staff route. `routes/api.php` keeps the two groups textually separate
because the failure worth designing against is a staff route quietly ending up
behind `device`, or the reverse. Two tests pin the boundary from both sides.

`User` deliberately does **not** use Sanctum's `HasApiTokens` trait. It exists
only for the token mode that was not chosen, and its presence would invite
someone to call `createToken()` later and silently create the table.

### Logins are audited, including failures

Approved alongside the mode decision. `AUDIT_LOG` is shaped around a target row,
and a login has no natural target, so `target_table` is `users` and `target_id`
is the account.

- `login` — attributed to the account, `actor_id` set.
- `logout` — same.
- `login_failed` and `login_throttled` — **`actor_id` is always null.**

That last point is the one that matters. Whoever typed the wrong password has
not proved they are the account holder, so attributing the entry to them would
put an action in an innocent person's audit trail. An audit log that can do
that is worth less than no audit log. `target_id` still names the account when
the address matches one, so an account under attack is visible on its own
trail, and the attempted address goes in `old_value` either way — a burst of
unknown addresses is itself the signal. These are staff work addresses, never
patient data.

### Supporting decisions

- **Throttling**: 5 failures per email+IP per minute, then 429. A staff login
  endpoint without it is a brute-force target, and the lockout is itself
  audited.
- **No account enumeration**: a wrong password and an unknown address return
  the identical status and message. A test asserts they cannot be told apart.
- **Session fixation**: the session id is regenerated on login and invalidated
  on logout.
- **A non-first-party request gets a 400 that names the problem.** Sanctum
  starts no session when `Origin`/`Referer` does not match
  `SANCTUM_STATEFUL_DOMAINS`; without a guard, the controller reached
  `$request->session()` and died with a 500 that told the operator nothing.
- **`SESSION_DRIVER` stays `file`.** A database driver would add a `sessions`
  table and break the same 20-entity promise this decision exists to protect.

### Barangay scoping has one implementation

`Domain/Auth/BarangayScope` (UT-016), for the same reason `SuppressionRule` has
exactly one: a second copy is a second place to drift, and the failure is
silent — a sub-admin shown another barangay's data has been handed records they
were never cleared for, and nothing in the response says so.

It is **not** a global Eloquent scope. A global scope applies invisibly and
would also filter the aggregation jobs and the device sync path, which
legitimately run across all barangays. An explicit call lets a reviewer see, at
each query, whether scoping was applied on purpose.

Scope is decided by **role**, not by whether `barangay_id` happens to be null.
A sub-admin with no barangay assigned is a misconfigured account and sees
**nothing** — the null check written the other way round would have shown them
everything. A test pins that.

## Consequences

- Phases 4 and 7 are unblocked. `EnsureRole` (`role:super_admin`) and
  `BarangayScope` are the two primitives their endpoints build on.
- **This is the first Phase 3 decision with a deployment precondition.** Record
  it in the Phase 9 plan: one registrable domain, `SESSION_DOMAIN` set to the
  shared parent, SPA origins listed in `SANCTUM_STATEFUL_DOMAINS`.
- `.env.example` gained `SANCTUM_STATEFUL_DOMAINS` and `FRONTEND_URL`, and
  `SESSION_DOMAIN` now carries a comment explaining what production needs.
- One existing test moved: `SchemaTest`'s absent-tables list gained
  `personal_access_tokens`. Nothing was weakened.
- UT-016 and UT-019 are now partially covered — the authorisation primitives
  exist and are tested, but the screens that use them are Phase 4/7.

## Traceability

- UT-016 (barangay-scoped isolation) → `tests/Feature/BarangayScopeTest.php`
- UT-019 (account management) → `EnsureRole`, `BarangayScope`; the console UI is
  Phase 4
- Figure 41 (audit log) → `tests/Feature/Api/StaffAuthTest.php`, the login and
  failed-login entries
- Device auth and the population boundary →
  `docs/adr/0003-device-api-and-sync-contract.md`
- Schema promise → `tests/Feature/SchemaTest.php`
