# Time-limited support access

Status: in progress.

## Outcome and scope

CORE-010/001/005: a brand owner grants a verified existing user a purpose-specific
support session for at most 24 hours, with read-only or connection-operator access.
Expiry and revocation apply to RLS and worker authorization. No ownership transfer,
management delegation, publishing, spending or automatic staff provisioning.

## Inspection and decisions

Extend the existing centralized current-authority predicate. Support cannot grant
support, alter allowances or approve knowledge. Existing mutation audit events
retain actor IDs; session grant/revoke records identify owner, purpose and window.
Provider credentials connected during support remain brand-owned, but new runs by
the expired actor are rejected until a currently authorized operator reconnects.

## Acceptance and failure cases

Owner must confirm exact recipient, brand, capability and duration. Unknown or
unverified recipients fail without granting anything. Expiry blocks reads and
worker checkpoints even when a session cookie or job predates expiry. Revocation
preserves evidence. All session reads remain brand-scoped.

## Ordered implementation

1. Add bounded session schema and audited grant/revoke RPCs.
2. Include unexpired, unrevoked sessions in current access predicate.
3. Add owner controls and session history on a dedicated support page.
4. Test actual RLS, grant boundaries and expired worker authority.

## Verification and rollout

Additive migration; npm run db:test and npm run check. No real support user is
invited or messaged during implementation. Provider verification remains deferred.

## Local verification evidence (25 October 2026)

Implemented owner grant/revoke controls, purpose, 1–24 hour expiry and centralized
capability checks shared by UI, RLS and workers. Twelve pgTAP assertions passed:
unknown recipient, excessive duration, self-escalation, current read/operator access,
expiry on actual RLS, expiry on queued job authorization and immediate revocation.
Existing independent grants remain effective; revoking one session is not a global
user ban. Recorded mutations retain actor audit events and grant/revoke history.
