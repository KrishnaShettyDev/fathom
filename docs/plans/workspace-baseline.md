# Workspace settings and baseline review

Status: in progress.

## Outcome and scope

ONB-001/002/004 and CORE-009: persist website/timezone settings, show actual setup
progress, and capture an immutable customer acknowledgement of monitoring scope,
data gaps and responsibilities. No inferred acknowledgement or production readiness.

## Inspection and decisions

Reuse verified sessions, workspace.manage, existing brand RLS and audit events.
The overview counts persisted rows; counts describe records, not performance.
Baseline reviews snapshot source health and evidence counts at acknowledgement.
Changing settings affects future collection; historical snapshots stay unchanged.

## Acceptance and failure cases

Only current owners can change settings or acknowledge a baseline. Other brands
cannot read reviews. Invalid timezone and blank scope/gaps/responsibilities fail.
Duplicate submissions return the original review. Missing data remains explicit.

## Ordered implementation

1. Add immutable baseline review RPC and read policy.
2. Add settings form and review form with explicit acknowledgement.
3. Replace stale overview copy with actual readiness counts and links.
4. Test permissions, idempotency and snapshot immutability using pgTAP.

## Verification and rollout

Run npm run check, npm run db:test; apply additive migrations and regenerate types.
Provider configuration, customer acceptance and browser verification remain separate.

## Local verification evidence (25 October 2026)

Implemented settings, persisted overview counts and immutable baseline reviews.
pgTAP passed owner/other-tenant boundaries, invalid timezone, explicit acknowledgement,
idempotency and preservation after later settings changes. No acknowledgement was
created for an actual customer. Customer sign-off and browser testing remain pending.
