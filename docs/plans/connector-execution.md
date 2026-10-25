# Connector execution and Shopify catalogue

Status: in progress; external app credentials remain deferred.

## Outcome and boundaries

CORE-008, INT-001, ONB-001: authorized connection operators connect an exact
Shopify shop through expiring OAuth, queue resumable catalogue reads and inspect
products/variants/collections and run health. Encrypt tokens with versioned AES-GCM
keys outside Postgres. State binds actor, brand, source and browser; callbacks are
single-use. Source generation fences stale jobs and authorization callbacks.

Use a private transactional outbox and pg-boss, current permission checks before
provider requests and commits, per-source serialization, bounded requests/pages,
checkpointed pagination, deterministic idempotent upserts and reconciliation.
User-facing data stays RLS protected. Only privileged server/worker code reads
credentials. Never log token payloads or provider response bodies.

## Failure cases

Wrong callback HMAC/state/browser/actor/shop, replay, expired state/token, revoked
agency, disconnected source, stale callback, throttling, cursor replay, interrupted
sync and partial catalogue. Deletion reconciliation runs only after all catalogue
pages succeed. Partial runs preserve older records and disclose incomplete data.
No publishing, orders or customer data.

## Steps and verification

1. Shared typed crypto/provider helpers, additive SQL for credentials/state/runs,
   allowance/outbox/catalogue, then transactional enqueue and disconnect fencing.
2. OAuth route/actions and connection controls; worker dispatcher and sync adapter.
3. Catalogue and run-health UI; signed webhook invalidation/reconciliation.
4. Real database authorization/fencing tests, crypto/provider behavior tests,
   Shopify operation validation and full workspace checks.

## Sources and configuration

Shopify standalone authorization and expiring-token documentation:
https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps
https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens
Shopify GraphQL is pinned to 2026-07; validate operation shapes before completion.
pg-boss documentation: https://pgboss.io/introduction

Production requires DATABASE_URL, versioned credential encryption keys, application
origin and Shopify app credentials/redirect/webhook configuration. No account is
connected by development fixtures. Live provider verification and restore tests
remain distinct release gates; migrations roll forward.

## Local verification evidence (25 October 2026)

Implemented encrypted OAuth credentials, Shopify callback/signature checks,
source-version fencing, refresh locks, real pg-boss queues/outbox, pagination
checkpoints, webhook receipts and scheduled reconciliation. Terminal or missing
queue jobs are reconciled to visible failed/partial states after interruption.

`npm run test:worker` passed using an isolated temporary database and intercepted
provider transport: real queue dispatch, encrypted credential reads, interrupted
pagination resume, complete-run tombstones and revocation during a request.
`npm run db:test` passed with connector and support-expiry enforcement tests.
Shopify products, variants and collections queries validated against 2026-07 with
read_products using the Shopify skill validator. No authorized store was called.
See provider-setup.md for deferred app/webhook configuration and live release tests.
