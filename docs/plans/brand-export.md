# Owner data export

Status: in progress.

## Outcome and scope

CORE-001/004/005: a current brand owner exports brand-owned records and audit
history without credentials or another client's data. Use an NDJSON stream with
manifest and completion checksum, consistent database snapshot, current owner
permission rechecked between batches, bounded transaction/statement lifetime and
cancellation cleanup. No external delivery, automatic deletion or retention policy.

## Acceptance and ordered work

1. Fixed table allowlist, parameterized brand filter and verified actor boundary.
2. Repeatable-read snapshot, bounded fetch batches, complete marker and checksum.
3. Authenticated no-store attachment endpoint and owner settings link.
4. Actual isolated-database tests for scope, token exclusion and midstream revocation.

Interrupted exports are incomplete and must not be imported as complete backups.
This is a customer portability export, not a disaster-recovery backup. Requires
server DATABASE_URL configuration; no credentials are configured during this task.

## Local evidence

Implemented owner-only endpoint, fixed table allowlist, repeatable-read cursors,
current authorization before/after batches, abort cleanup and completion checksum.
The isolated database/worker test passes scope checks, raw evidence/history inclusion,
credential-table exclusion, checksum verification and midstream revocation. Initial
teardown exposed a connection lifecycle issue; exports now receive an explicitly
owned pool and worker shutdown waits for active outbox dispatch. The rerun exits 0.
HTTP cookie/export and large-volume production verification remain outstanding.
