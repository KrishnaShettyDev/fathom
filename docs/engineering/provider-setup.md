# Phase One provider setup

Configuration is deferred at the owner's request. Blank example files document
requirements; they are not usable credentials. No live integration is verified.

## Runtime setup

Use the pinned Node version and `npm ci`. Apply migrations in order before
starting web and worker. Web reads `apps/web/.env.local`. Worker reads its process
environment; a local ignored file can be loaded with Node's `--env-file` option
when running the built worker. Do not copy secrets into tracked files or commands
that will be logged. Set environment values through the deployment secret store.

Both runtimes need a direct trusted PostgreSQL connection in `DATABASE_URL`, with
access to private credential/outbox schemas. This is privileged infrastructure;
never expose it to browser clients. Supabase publishable keys remain distinct.
`APP_ORIGIN` is the exact web origin, HTTPS in production, with no path or query.

Use a secret-manager-generated 32-byte random key encoded as base64. Set
`CREDENTIAL_KEYS_JSON` to a JSON object mapping a version label to that key, and
`CREDENTIAL_KEY_VERSION` to the active label. Keep old keys until all credentials
are re-encrypted or disconnected. Ciphertext binds to both brand and source ID.
Key loss requires account reconnection; database backup alone cannot recover it.

## Shopify

Configure an authorized app with `read_products` and expiring offline access.
Register `/api/connectors/shopify/callback` on APP_ORIGIN. Set the app client ID
and secret in both runtimes. API version is pinned to 2026-07.

Configure signed webhooks to `/api/connectors/shopify/webhook` for product create,
update/delete, app uninstall and scope changes. The endpoint expects raw Shopify
HMAC signatures and unique delivery IDs. Webhook registration is provider setup,
not performed by this application. Daily catalogue reconciliation also catches
missed changes. A shop can have only one active source authorization in this app.

Register the exact `shop.myshopify.com` account, authorize, then request a sync.
Compare products, variants, collections, currency, null inventory and tombstones
against an authorized development store. Exercise token refresh, partial pages,
replayed webhooks, uninstall and mid-sync revocation before release.

## Search Console and GA4

Enable Search Console API, Analytics Data API and Analytics Admin API in the
Google project. Configure an OAuth web application, consent screen and exact
`/api/connectors/google/callback` URL. Set client ID and secret in both runtimes.
Readonly scopes are webmasters.readonly and analytics.readonly, selected by
source type. OAuth uses state, browser binding and PKCE.

Register the exact Search Console property URL or `sc-domain:example.com`, or
GA4 `properties/12345`. Verification checks that exact property. No first-account
fallback exists. The current sync requests 28 days ending three days before today
in the source timezone. Missing daily rows remain unavailable. GSC uses final web
search data and Pacific time; GA4 uses its property timezone and retains metadata
for thresholding/sampling. Daily users must not be summed as unique period users.

## Observations and audits

Set `OPENAI_API_KEY` and an explicitly selected `OBSERVATION_MODEL` in the worker.
Set the same model and `OBSERVATIONS_ENABLED=true` in the web server only after
the worker is configured; the web server does not need the model API key. Confirm provider terms, retention rights and the chosen model's support
for Responses before enabling collection. No model is silently selected.
The brand's monthly observation allowance defaults to zero. A fixed cohort has
at most five questions, three samples per question and four comparison subjects.
Each request has an output-token ceiling; the allowance counts planned requests,
not dollars. Configure a provider project budget separately. Unknown interrupted
requests are not automatically retried. Scheduling requires current creator
permission and configuration. API samples never represent consumer UI visibility.

Website audits need a saved public website and collection permission. They inspect
at most 20 static same-site pages, respect robots rules, bound redirects/body size
and reject private/reserved destinations after DNS resolution. They do not execute
scripts or certify full-site SEO health.

## Verification and recovery

Run `npm run check`, `npm run db:test`, `npm run test:auth` and
`npm run test:worker` and `npm run test:migrations` with local Supabase running. Worker integration tests create
and remove their own database; intercepted transport is test-only. Never run these
against production by replacing their local database targets.

After a process crash, queue retries resume catalogue checkpoints. The dispatcher
reconciles terminal/missing jobs to explicit partial/failed states. Observation
attempt records prevent replay of uncertain billed requests. Disconnect purges
stored tokens, fences queued runs and preserves historical evidence.

A production restore rehearsal, credential rotation drill, actual provider
contracts, customer acceptance, browser accessibility and billing reconciliation
are separate release gates. Keep new work disabled during recovery until queue
intent and current provider/source authorization have been reconciled. Do not
restore by deleting history or editing already-applied migrations.

## Owner portability export

Settings provides `/api/brands/{id}/export` to current brand owners. It streams
NDJSON with a manifest, scoped records, and final complete record. Verify the SHA-256
of every byte before the complete record against its `sha256` value. Missing final
completion means the download is incomplete. The export includes brand-owned
history, not encrypted credentials or another client's records. Revocation during
streaming stops later batches. The request has a two-minute ceiling; large-volume
background export storage remains future work rather than silent truncation.
