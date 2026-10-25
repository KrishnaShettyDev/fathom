# Engineering standards

These are review criteria, not a claim that unfinished software meets them.

## Architecture and maintainability

Use the PRD's modular monolith: `apps/web` for Next.js HTTP/UI, `apps/worker`
for persistent background work, and focused shared packages. Add packages when
there is a real consumer; do not generate empty future services. Domain code
must not depend on React, Next.js, or provider SDKs. Connectors translate provider
contracts; they do not decide user permissions. Keep one typed database query
layer and SQL migrations as the schema source of truth.

Use strict TypeScript, explicit boundary schemas, and exhaustive state handling.
Do not introduce `any`, unchecked casts, non-null assertions, lint suppression,
or catch-and-ignore blocks to evade a design problem. Treat external input as
`unknown` until validated. Prefer clear names and small cohesive functions.
Extract duplication when it represents the same rule, not merely similar syntax.
Avoid generic frameworks for a single use case. Explain non-obvious constraints
in comments; do not narrate the code. Remove abandoned code and unused dependencies.

## Authorization and ownership

A brand is not a store. Ownership, agency access, and payment are separate.
Agency-created brands remain unclaimed until a verified ownership procedure.
Neither credentials nor matching email domains prove ownership.

Derive the actor from a verified session. Deny by default; check explicit
capabilities for the requested brand on the server. IDs supplied by clients are
selectors, never authorization. RLS protects user-facing database access; worker
repositories must also enforce tenant scope. Tenant references use composite
foreign keys. Test list, detail, mutation, export, storage, and job boundaries as
those surfaces are introduced. Revocation and support-session expiry must block
new operations and queued work using current authority, not cached role claims.

## Data and migrations

Use exact decimal or integer amounts with explicit currency and units. Preserve
source timezone, reporting window, freshness, and missingness. Never silently
coerce unavailable metrics into zero. A successful HTTP response is not evidence
that a connector has complete or current data.

Add constraints for durable invariants and indexes for actual query paths.
Migrations must be forward-compatible across rolling web/worker deployments;
use expand-and-contract for destructive changes. Test migrations on an empty
local database and representative prior schema. Do not edit applied migrations.
Document restoration/roll-forward procedures and destructive consequences.
Maintain source lineage for derived artifacts and deletion workflows.

## Integrations and jobs

Verify current official provider documentation and actual account capabilities
before implementing a connector. Pin versions and record access prerequisites.
Never invent endpoints or claim an integration works from mocked responses.
Keep raw webhook bytes for signature verification; durably record replay-safe
receipts before acknowledgement. Persist job intent transactionally or via outbox.
Version job payloads; bound retries, concurrency, pagination, timeouts, and costs.
Use checkpoints and reconciliation. Test duplicates, reorderings, revocation,
rate limits, partial success, and worker interruption.

Load secrets only at execution; encrypt credentials with versioned keys held
outside the database. Redact logs and errors. Never place secrets in client
bundles, job payloads, fixtures, screenshots, or documentation. OAuth state must
be expiring, single-use, and bound to the initiating actor and brand.

External writes require exact-version approval, runtime authorization, idempotency,
and readback. Timeouts can mean unknown outcomes; reconcile before retrying.
Phase One does not publish content or operate advertising. Recovery freezes
external writes until reconciliation. Do not promise universal rollback.

## Evidence and AI

Models may propose; deterministic code controls permissions, budgets, approvals,
and execution. Untrusted pages, documents, and model responses cannot authorize
tools. Approved facts require provenance; generation cannot approve itself.
Record collection method, surface, model/parser version, cohort, requested and
verified geography, timestamps, and valid sample counts. Missing observations
reduce coverage, not measured visibility. API output is not a consumer observation.

Recommendations need inspectable evidence and an explanation of prioritization.
Do not invent revenue lift, causal claims, statistical confidence, or profitability.
Before generation release, meet the PRD's reviewed-fixture and deterministic
factual evaluation gates; preserve failures as regression fixtures.

## UI and APIs

Provide loading, empty, partial, stale, disconnected, forbidden, and recoverable
error states where relevant. Show brand and account context for consequential
operations. Use semantic HTML, keyboard access, visible focus, labeled inputs,
and non-color-only statuses. Charts need readable summaries.

Validate request shape, authorization, and resource ownership independently.
Use stable errors with safe messages and trace IDs, bounded body sizes and list
pagination. Protect cookie-authenticated mutations against CSRF. Do not expose
raw provider errors. Long work belongs in the worker, not an HTTP request.

## Tests and completion

Test behavior and invariants rather than private implementation details. Every
permission rule needs allow and deny cases; tenant isolation needs real database
RLS and constraint tests, not only mocked repository tests. Test financial and
concurrent behavior at the layer that enforces it. Use provider fixtures for
contract tests and authorized sandbox accounts for integration verification.

Run formatting, linting, type checking, relevant tests, and build before handoff.
Never skip or weaken a failing check without documenting the actual defect.
Keep CI deterministic with a committed lockfile and explicit runtime version.
A passing build proves compilation, not tenancy, security, or production readiness.
Inspect the final diff for secrets, dead code, accidental scope, and misleading UI.
Document external blockers and distinguish implemented, locally verified,
sandbox-verified, and production-verified behavior.
