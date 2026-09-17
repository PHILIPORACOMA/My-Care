# ADR-0005: Device self-registration, token storage, and facilities

## Status

Accepted 2026-09-17. Implemented in `apps/api`, verified against MySQL 8 —
Pest 115 passed, 397 assertions. **No manuscript amendment.**

## Context

`TRIAGE_SESSION.device_id` and `SYNC_BATCH.device_id` (Tables 13, 22) mean every
uploaded session comes from a `DEVICE` row (Table 12). Phase 3 only had a
development seeder to create one. The manuscript has no enrolment screen, yet
patients use their own phones (Table 27), so something had to decide how a
phone becomes a device.

Two further gaps surfaced at the same time:

- `DEVICE.api_token` was stored and compared in plaintext (ADR-0003's known
  limit).
- `FACILITY` (Table 20) was orphaned — no module read it — while Figure 27's
  emergency screen has a "Call for help" button that needs a number to call.

## Decision

### 1. Devices register themselves, anonymously, and are approved at once

Philipo's decision, 2026-09-17. `POST /api/v1/devices` takes only
`barangay_id` and `type` (`patient_phone`, `health_station`, `bhw_phone` —
Figure 33 names the last two). It creates an approved, active `DEVICE` and
returns a token **once**.

Rejected alternatives:

- *Register but wait for approval.* Safer against junk data, but a super-admin
  would have to approve every patient phone, so in practice patient phones
  would never sync.
- *Only enrolled health-station devices sync.* Patient phones would triage
  offline but never contribute to surveillance, which undercuts Figures 31–35.

Consequences accepted with it:

- **Anyone can register a device and upload plausible-looking sessions.** The
  mitigations are a per-IP rate limit (10 registrations an hour), revocation
  from the console (`is_approved = false`, audited), and the fact that every
  session names its device, so a revoked device's uploads are identifiable.
  Surveillance figures are therefore indicative, not evidentiary — worth saying
  plainly at the defence.
- Registrations are audited as `created` by `system`. At Carcar's scale this is
  acceptable volume, and knowing when devices enrolled is security-relevant.
- The request accepts no identifying field. A test sends a phone number, a name
  and a latitude and asserts none are stored.

### 2. `DEVICE.api_token` holds a prefix and a digest, not the secret

Stored value: `<12-char lookup prefix>.<sha256 hex of a 48-char secret>` — 77
characters, inside the dictionary's `VARCHAR(80)`. The column keeps its name,
type and width, so this is not a schema change. The prefix makes the row
findable; the digest means a leaked backup is not a working credential. The
secret is high-entropy random, so an unsalted SHA-256 is appropriate (this is a
key, not a password). Comparison is constant-time; the prefix is validated
against its exact shape so it can never smuggle a `LIKE` wildcard.

### 3. The pending-upload queue is reported, not stored

Figures 33 and 40 show "the size of the pending upload queue". That number
lives on the handset and has no column. Devices send `X-Pending-Sessions` on
each authenticated request; the server caches the latest value per device for
14 days. It is a monitoring hint: if the cache is cleared, dashboards show "not
reported" until devices check in.

### 4. `FACILITY` powers "Call for help"

`GET /api/v1/facilities` (device-authenticated) returns active facilities, and
the PWA caches them. Facility names and numbers are real-world contact details
that must come from the City Health Office, so they are loaded from a CSV with
`php artisan mycare:facilities:import <file>` — one transaction, every row
through the model so each change is audited. The PWA prefers a facility of type
`emergency_hotline`, then `rhu`, and falls back to the national emergency number
911 when nothing is configured.

### 5. The barangay list is public and seeded

`GET /api/v1/barangays` is unauthenticated (a device must choose a barangay
before it can register). `BarangaySeeder` joins the default seed chain with
Carcar City's 15 barangays as PhilAtlas lists them — the source the manuscript
cites. **Verify against the City Health Office's list before deployment.**

## Traceability

- UT-001 (barangay selection) → `DeviceRegistrationTest` ("lists barangays
  publicly")
- UT-012, UT-013 device side → Phase 6 PWA
- UT-014 pending queue → `PendingQueueReport`
- Figure 27 "Call for help" → `ReferenceDataController::facilities`,
  `FacilityImportTest`
