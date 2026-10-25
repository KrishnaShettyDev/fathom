# Authenticated HTTP isolation

Status: locally verified. Browser and live-provider acceptance remain separate.

## Outcome and scope

CORE-001/004, INT-009: exercise real authenticated web pages, report downloads,
owner exports and database RPC HTTP requests for two unrelated brands and a
revoked agency member. No provider configuration, browser automation or customer
records. Previously denied browser access remains untouched.

## Boundaries and decisions

Use real local Supabase OTP sessions. Create disposable principals, copy only
necessary identity fields to a fresh temporary application database, apply all
migrations and run a separate PostgREST container against it. A local test router
forwards auth to the existing local auth service and REST to the disposable one.
Run the actual production Next server on a separate ephemeral port. This tests
HTTP authorization, cookies and real RLS; it is not a browser/accessibility test.
Reuse installed container images; no service accounts or external provider calls.

## Acceptance and failure cases

Owner sees own report and export; unrelated identities cannot read or mutate it.
Agency can read the granted brand report, cannot use owner export, then loses
access with its existing session immediately after revocation. Record contents
never leak through denial/error responses. Every test-owned process, database,
container and auth principal is cleaned up on success or failure.

## Ordered steps and verification

1. Build disposable database/auth/HTTP harness and bounded cleanup.
2. Exercise allow/deny pages, downloads, exports and RPCs with actual sessions.
3. Add a repeatable script and CI job step after the production build.
4. Run npm run test:http, relevant existing checks and inspect the final diff.

Download error contract: both download endpoints return 401 for absent/invalid
sessions, 404 for inaccessible records, and 503 for auth or database outages.
Do not disguise service failures as missing records or force a needless login.
Add outage injection in the local forwarding harness and assert no private content
or cacheable error response escapes. This changes HTTP responses, not permissions.

## Verification evidence

The harness uses the production Next build, real local OTP cookies, a separate
PostgREST process, all application migrations and actual RLS. It tests own report
page/download, unrelated-brand denial, forged mutation via HTTP RPC, owner export
scoping, agency revocation with unchanged cookies and safe outage responses. Also
covers workspace-selector tampering and support expiry without forcing re-login.

The first run found a harness assumption mismatch: report download correctly
returned 401 rather than a redirect. The assertion now checks the documented API
contract. Inspection also found inconsistent auth/outage responses in owner
export; both download routes now distinguish 401, 404 and 503 with no-store errors and per-request trace IDs.

`npm run test:http` builds current connector/web code before running, so stale build
artifacts cannot silently validate older code. CI executes it after database and
worker checks. Cleanup attempts every test-owned resource even when another
cleanup fails, reports failures, and never prints local keys or connection strings.
This does not verify browser behavior, external providers or production recovery.

Final checks on Node 24.22.1: `npm run check` passed formatting, lint, types,
unit/lifecycle tests and production builds. `npm run test:http` passed every HTTP
case after rebuilding current code. `git diff --check` passed. Test-owned databases,
REST containers and auth principals were checked for cleanup after the run.

Download failure trace verification also passed: every tested 503 response carries
an ID matching a structured server event containing only route, stage, event name
and request ID. No local publishable/service-role credential appeared in captured
web logs. Full log buffers stay in test memory and are never printed or saved.
