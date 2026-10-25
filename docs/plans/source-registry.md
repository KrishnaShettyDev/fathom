# Source account registry

Status: implemented and locally verified. Provider configuration is deferred at user request.

## Outcome and scope

A connection operator records which real source account a brand intends to use,
sees its actual setup state, and disables or resumes that setup record. Supports
CORE-008 and ONB-001/003 groundwork. Saving a label/reference does not verify
provider access, authorize OAuth, or imply any imported data.

## Boundaries and non-goals

Reuse verified sessions, current integrations.connect authority, audited RPCs and
RLS. Add a source registry with immutable events, optimistic versions and unique
brand/provider/reference keys. No tokens, OAuth, provider API calls, job scheduling,
account discovery or live synchronization in this slice. Account references are
user-supplied identifiers, not ownership evidence. No new dependency.

## Acceptance and failure cases

- Only current connection operators can save or change a source record.
- Readers see only authorized brand records; direct table mutations denied.
- Saving retries cannot duplicate an account; stale changes cannot overwrite.
- Initial state is awaiting authorization; resuming cannot claim a working link.
- Disable is explicit about local setup scope; no provider revocation is claimed.
- No credentials accepted; capability/sync fields show unavailable until verified.
- Bounded cursor pagination, empty state, error and pending feedback required.

## Ordered steps

1. Add registry, constraints, RLS, audit and create/state-change RPCs.
2. Replace placeholder-only Connections with persisted records and real forms.
3. Verify permissions, isolation, duplicate/stale/revoked behavior in Postgres.
4. Regenerate types; run db:test, check, test:auth; inspect diff and record evidence.

## Rollout and outstanding work

Use additive migrations and roll forward. Do not discard history to recover.
Browser and provider verification remain pending. Encrypted credentials, OAuth,
transactional job intent, webhook receipt and worker checkpoints are subsequent
connector infrastructure work; this slice does not claim those are complete.

## Verification evidence

- Additive migrations applied locally and generated types refreshed. A follow-up
  migration preserves case-sensitive account references instead of lowercasing
  arbitrary property paths; server-action validation preserves case too.
- `npm run db:test`: 106 assertions passed, including 22 source registry checks.
  Covered duplicate registration, initial/resumed unverified state, stale changes,
  unsupported providers, direct mutation denial, analyst/operator distinctions,
  cross-brand selectors, revocation and transactional audit events.
- `npm run check`: formatting, lint, type checks, five existing unit/lifecycle
  tests and web/worker production builds passed after final changes.
- `npm run test:auth`: local OTP, identity, SSR cookies, replay and sign-out passed.
- Direct `node --import tsx` validation assertion preserved a case-sensitive
  property path. `git diff --check` passed; post-test source count remained zero.
- React review: server-side parallel reads, independently authenticated actions,
  labeled fields, explicit account/brand confirmation, pending/error/status text,
  bounded pagination and semantic account details. Previous placeholder component
  removed; the real Connections route now owns the interface.

No browser verification or source-specific HTTP integration test was run. Real
provider authorization, account validation and sync are not implemented. The
reference is an intent record, not the authoritative external account identity.
Recovery is disable/resume of local setup only; it does not revoke credentials or
stop an external provider. No source secrets or business fixtures were seeded.
