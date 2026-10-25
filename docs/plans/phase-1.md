# Phase One: Intelligence

Status: substantial implementation locally verified; Phase One is not complete.
Real provider accounts and production configuration remain deferred.
Source: PRD Parts 1, 2, 5, 6, and 7. This file tracks delivery, not a replacement PRD.

## Outcome

A brand or agency connects real data, reviews a baseline, accepts or assigns an
evidence-backed opportunity, and exports a useful report with fixed methodology,
filters, timestamps, and denominators. This is Phase One activation; publishing
is not required and customer-reported off-platform work must be labeled.

## Ordered milestones

1. **Repository foundation.** Shared agent rules, strict TypeScript workspace,
   runnable web and worker entrypoints, repeatable checks, CI, architecture record.
   No fake product metrics. Deploy the empty runtimes after environment provisioning.
2. **Identity and tenancy.** Email OTP, organizations, brand ownership/claim,
   memberships, scoped agency grants, expiring invitations, audit history, and RLS.
   Test two agencies sharing one brand plus an unrelated brand. Prove revocation
   and cross-brand denial at database and HTTP boundaries. CORE-001–005, CORE-010.
3. **Connector infrastructure.** Connection capabilities/health, encrypted token
   lifecycle, OAuth state, refresh locks, queue/outbox, webhook inbox, checkpointing,
   bounded retries and current-authority checks. CORE-008; R03, R04, R11.
4. **First complete catalogue slice.** Connect an authorized Shopify development
   store; sync paginated products, variants and collections; display health and
   catalogue; handle product deletion, uninstall, retries and revocation.
   INT-001, ONB-001/003. No order/customer ingestion or publishing scope.
5. **Owned analytics.** GSC and GA4 explicit property selection, limited backfill,
   freshness, source metric definitions, missing dates and connection recovery.
   INT-003; CORE-009. Do not combine incompatible currencies or attribution.
6. **Knowledge and observations.** Approved facts with provenance; one permitted
   observation adapter; versioned question cohorts, evidence, competitor coverage,
   separate requested/observed geography and API/consumer surfaces. INT-002/004–006.
7. **Diagnostics and opportunities.** Bounded SSRF-safe crawling, reproducible
   findings, transparent ranking, assignment/comments/snooze/dismiss/reopen,
   history and source lineage. INT-007/008. No unsupported revenue predictions.
8. **Reports and release hardening.** Immutable report scope, annotations,
   methodology, export authorization, entitlements/usage limits, accessible flows,
   restore rehearsal and real customer onboarding. INT-009/010; CORE-006/007.

Each milestone needs its own feature plan before implementation. Add metering
before any expensive collection; do not postpone cost enforcement until launch.

## First complete engineering acceptance

A user logs in, creates a brand, invites an agency member, connects a development
store, synchronizes products, inspects sync health, and revokes agency access.
Revoked users and queued jobs lose authority. Duplicate/reordered webhooks do not
corrupt inventory; interrupted pagination resumes without duplicates. A missing
scope or expired token appears as degraded access, never zero inventory.

## Release gates

- Real-data accuracy checked against authorized provider accounts.
- Tenant isolation across HTTP, database, jobs, reports, and storage verified.
- Partial cohorts change coverage without lowering visibility ratios.
- Model, parser, surface, and cohort changes annotate comparison discontinuities.
- Usage exhaustion blocks optional collection while preserving stored evidence.
- Recovery, deletion lineage, secret redaction, and accessibility checks recorded.
- Representative brand and agency users inspect evidence and produce a report.
- Generation, if enabled, passes the PRD's minimum 100 reviewed fixture gate.

## Deferred scope

No content publishing, ad execution, autonomous agents, arbitrary workflow builder,
hosted landing-page service, or expansion connectors in this release. Shopify,
GSC, GA4, and one permitted observation adapter are the initial connector set.

## Owner decisions and external prerequisites

Production region, first market/language, payment eligibility, retention terms,
observation collection rights/provider, support owner, spending ceiling, and design
partners remain open. Development can proceed without inventing those answers.
Real deployment needs authorized Railway/Supabase projects; OTP needs email
configuration; real Shopify verification needs an app and development store.

## Current delivery evidence (25 October 2026)

- Owner OTP/workspaces, agency invitation/grant/revocation, exact-version Brand
  Knowledge, source registry, scoped opportunities and immutable reports.
- Shopify and Google OAuth/credential handling; catalogue and daily analytics
  adapters; actual PostgreSQL-backed queue/outbox, checkpoints, webhook receipts,
  reconcilers, usage reservations and current-authority worker checks.
- Bounded static website audits and immutable/recheckable findings; fixed API
  observation cohorts, quotas, schedules, raw evidence and same-run comparisons.
- Real-data screens for catalogue, analytics, audits, observations, opportunities,
  reports, settings and baseline acknowledgements. No mock business data.
- Agency staff invitation/acceptance/revocation, independent knowledge editing and
  approval, opportunity/report delegation, current-member assignment choices and
  verified recipient ownership claims from unclaimed agency setup requests.
- Owner data export uses a consistent NDJSON snapshot, completion checksum and
  current-permission checks between batches; credentials are excluded.
- Owner-controlled support sessions with purpose and expiry enforced at RLS and
  worker boundaries. Provider configuration documented without provisioning.
- 240 pgTAP assertions passed. All 23 migrations applied in order to a fresh
  application schema; the same assertions passed there. Schema-only restoration
  passed; production data recovery remains unverified.
- Authenticated HTTP harness now exercises the production Next server, real OTP
  cookies and isolated PostgREST/RLS: report access, owner export, denied mutations,
  selector tampering, support expiry, agency revocation and service outages.
- Local OTP/session test passed. Isolated worker tests passed queue dispatch,
  pagination recovery, deletion reconciliation, revocation, uncertain observation
  requests, analytics missingness and terminal-job reconciliation.
- Shopify catalogue GraphQL queries validated against 2026-07. Provider transport
  fixtures are tests only and are not proof of authorized live integration.

## Remaining implementation and release gates

This is more than a final credentials/configuration task:

1. Subscription/billing state, included entitlements, overage policy and reconciled
   billing webhooks. Billing provider choice is pending the user's answer.
   Current request quotas are not billing or currency spending controls.
2. Retention/deletion lifecycle: the user must select manual review, a cancellation
   window or immediate owner-confirmed deletion before destructive rules are built.
   Portability export and source credential removal are implemented.
3. Browser/accessibility tests and broader HTTP coverage of remaining workflows.
   Authenticated report pages/downloads, owner exports, RPC denial, current-session
   revocation and service outages now have real HTTP integration coverage.
   Browser access was denied; no workaround or browser result is claimed.
4. Authorized live Shopify/GSC/GA4/observation tests, deployment/email configuration,
   secret rotation, production data recovery/reconciliation, operational ownership
   and representative paying brand/agency customer acceptance. No configured
   provider credentials were used. Conflicted ownership requests stop for human
   resolution; existing brand ownership is never automatically transferred.

See `phase-1-completion.md` and individual feature plans for implementation evidence.
Production release remains blocked until all applicable PRD gates are demonstrated.
