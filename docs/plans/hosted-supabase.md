# Hosted Supabase connection

Status: local configuration complete; hosted database deployment blocked pending
administrative access in the active session.

## Outcome and scope

Connect the existing SSR application to the user-selected hosted project
`tnvsmiffrwaavoiousgr`, preserve current authorization/session policies, and register
project-scoped Codex MCP access. CORE-001/008 and Phase One deployment prerequisites.
No sample todos, invented business data, masked secret values or database-password
placeholders. Existing dependency versions stay pinned; avoid duplicate clients.

## Boundaries and steps

1. Verify installed clients and current official SSR/MCP guidance.
2. Update ignored web environment using the supplied project and publishable key;
   preserve unrelated values and a private backup of the existing local settings.
3. Probe public Auth/JWKS and schema availability without creating users or data.
4. Register the exact project-scoped MCP endpoint and initiate OAuth login.
5. Inspect hosted migration history before applying any migrations. Database access
   needs authenticated MCP or a real connection credential; placeholders do not work.
6. Verify the existing app and record completed work versus external blockers.

## Failure and verification

Keep private credentials out of Git and logs. HTTP-only server-session design stays
intact; no browser Supabase client is needed for current server-action workflows.
The existing proxy performs actual user validation and propagates refreshed cookies.
A publishable key is not database administration authority. Do not infer deployed
schema or email delivery from an available project endpoint. Local isolated auth,
database and HTTP tests remain separate from hosted verification.

## Configuration and evidence

- Existing pinned `@supabase/ssr` and `@supabase/supabase-js` dependencies are
  installed. The standalone `@supabase/server` HTTP handler library is not needed
  by the existing Next.js SSR implementation.
- Ignored `apps/web/.env.local` now selects the hosted project using the existing
  server-only variable names. Its prior contents are preserved in the ignored
  `.env.local.before-hosted` file; both files have mode 0600. No masked secret or
  password placeholder was saved. No browser client or sample todos were added.
- Codex MCP was registered with the requested project reference and feature list.
  OAuth login succeeded and `codex mcp list` reports OAuth authentication. The
  current agent session does not expose the newly registered Supabase tools;
  reopen the Codex session to load them before inspecting remote migrations.
- `npm run supabase:check` makes read-only requests using the configured
  publishable key. Auth settings returned 200, email is enabled, and the JWKS
  endpoint returned one public signing key. All 26 application tables returned
  404/PGRST205 through the REST API. The preflight correctly exits nonzero. This
  does not prove the database is empty; inspect migration history and API schema
  configuration before applying any of the 23 repository migrations.
- No hosted migrations, users, emails or business records were created.

Verification on 2026-10-25 using Node 24.22.1:

- `npm run check` passed formatting, lint, workspace type checks, unit tests and
  production builds.
- `npm run test:http` passed real local OTP cookies, protected pages/downloads,
  tenant and owner-export isolation, RPC enforcement, selector tampering, support
  expiry, agency revocation and safe Auth/database outage responses. This used
  disposable local services; it is not hosted acceptance evidence.
- `npm run supabase:check` exited 1 as expected for the hosted schema failure
  described above. No migration or database integration tests were rerun because
  this change does not modify SQL or application authorization.
- Final changed-file formatting and `git diff --check` passed. Both local
  environment files are ignored by Git.

## Remaining hosted acceptance

1. Reload Codex to expose the authenticated MCP tools, inspect existing hosted
   schema and migration history, and deploy the missing migrations through the
   reviewed migration process. Repeat `npm run supabase:check` afterward.
2. Configure the real `DATABASE_URL` for worker/export operations in the appropriate
   ignored environment or deployment secret store. A publishable key cannot
   authenticate a direct PostgreSQL connection. Never paste database credentials
   into tracked files or chat.
3. Configure Auth site URL, six-digit OTP email templates containing `{{ .Token }}`,
   expiry/resend settings and SMTP per `docs/engineering/local-development.md`.
   Verify delivery and an authorized hosted sign-in/workspace flow; public endpoint
   availability does not establish these behaviors.
4. Provider credentials, encryption keys and other Phase One release gates remain
   tracked in their existing plans. Optional third-party agent skills were not
   installed; they are not runtime prerequisites.
