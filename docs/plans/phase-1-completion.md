# Phase One completion

Status: in progress. External configuration stays deferred at the user's request.

## Outcome

Complete the Phase One intelligence loop: ingest real source data, inspect scoped
facts/evidence, prioritize and track work, and produce immutable client reports.
Covers CORE-001–010, ONB-001–004, INT-001–010 within Phase One only.

## Decisions and boundaries

Keep the existing Next/Supabase/Node-worker modular monolith. Reuse current
capability predicates, verified sessions, source registry and fact revisions.
Never substitute synthetic business data or represent API samples as consumer
observations. Real provider/customer verification remains a release gate even
when implementation and local contract tests pass. No publishing or ad spending.

## Ordered implementation

1. Complete shared evidence, opportunity workflow and immutable report snapshots;
   enforce current tenant authority on details, mutation and export.
2. Add connector credential encryption, expiring OAuth state, transactional job
   intent, bounded worker retries/checkpoints and usage reservations.
3. Implement Shopify catalogue adapter and lifecycle; owned Google analytics
   adapters with exact property selection and visible incomplete coverage.
4. Implement bounded website audit and permitted observation collection, scoped
   cohorts and comparable denominators; connect findings to opportunities.
5. Complete onboarding/readiness, settings and remaining identity/revocation tests.
6. Run full local checks, provider-contract validation and release-gap audit.

## Acceptance and failure paths

Opportunities reference actual evidence, preserve comments/status history and
support assignment, priority, snooze, dismiss, reopen and tracked work. Fact
corrections flag dependent recommendations. Reports capture exact scope, dates,
timezone, methodology, coverage and annotations; exports cannot change later or
bypass revocation. Source disconnect and revoked actor authority block new jobs
and checkpoints. Partial/failed observations affect coverage, not brand absence.
External requests are bounded, redirect/SSRF-safe and never log secrets. Usage
exhaustion blocks new collection while preserving existing evidence.

## Verification

Database tests against real RLS/RPC/constraints, HTTP authorization checks, crypto,
provider parsing and worker lifecycle behavior tests; formatting, lint, types,
production builds. Browser denied previously; do not bypass that restriction.
Provider verification requires configured authorized accounts at the final setup
stage. Restore rehearsal and representative customer acceptance are not replaceable
with passing unit tests. Each migration is additive; recover by rolling forward.

## Evidence and unresolved scope

See phase-1.md for the current requirement gap list. Core collection/review/report
paths are implemented and locally tested, including agency staffing, claims, delegated workflows and owner export. Billing,
deletion policy and broader HTTP/browser acceptance remain unfinished.
Do not describe this as "Phase One complete pending configuration".

Local evidence: 240 pgTAP assertions; 23 sequential migrations on a fresh application
schema; schema restore; OTP/session verification; isolated real queue/worker tests;
provider normalization, credential/signature and audit/mention tests. Authorized
provider accounts and customer acceptance have not been exercised.
