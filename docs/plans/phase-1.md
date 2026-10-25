# Phase One: Intelligence

Status: frontend and initial owner identity/workspace slice implemented locally.
No live source integrations.
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

## Delivery evidence

- Reviewed the supplied PRD and its final decisions/pressure-test requirements.
- Shared agent instructions and feature-planning template written.
- No authentication, database policy, connector, or customer workflow is complete.

- Web/worker scaffolds, strict TypeScript, exact dependency pins, lockfile,
  formatter/linter, tests, and a CI workflow now exist. See the foundation plan
  for passed checks and environment-blocked verification; this is not a release.

- User prioritized the frontend next. The Fathom-styled intelligence interface is
  implemented with labeled fixtures and empty states across eight routes. See
  `frontend-intelligence.md` for verification and browser-access limitations.
  This changes implementation order, not the backend or release-readiness gates.

- All application mock data and sample exports have been removed at the user's
  direction. Real email OTP, server sessions, owner-created workspaces, SQL RLS,
  transactional creation and audit records are now implemented. Local database
  and auth tests passed; see `identity-and-real-data.md`. Agency claims/invitations
  and connectors remain unfinished; this is not completion of milestone 2.
