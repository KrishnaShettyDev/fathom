# Identity and real-data foundation

Status: implemented and locally verified at the database/auth layer.
Supersedes the frontend plan's sample-data mode.

## Outcome and scope

Remove all fabricated brands, measurements, inventory, evidence and exports from
application code. Establish real email OTP sessions and durable brand workspaces
in Supabase, before connecting vendor data. CORE-001/003/005/008, ONB-001.
Retain Fathom styling. Unimplemented collection is unavailable, not zero.

This slice implements owner onboarding, organization/brand records, current-member
RLS, session-bound workspace selection and audit events. Agency invitations,
ownership claims, billing, credentials, connectors, and customer analytics follow
in separate slices. No fake success states or localStorage business database.

## Inspection and decisions

No Supabase configuration or existing database schema is present. Docker is
available; use an isolated local Supabase instance for development and actual
Postgres/RLS tests. No seed business data in the application. Tests create isolated
transactional records, never customer-visible fixtures. Hosted project selection
is pending user input; do not provision or choose a production region implicitly.

## Ordered steps

1. Remove fixture imports and sample UI; preserve navigable source-specific empty states.
2. Add Supabase SSR cookie/session handling, real OTP forms and server-side checks.
3. Add transactional owner onboarding with SQL constraints, RLS and append-only audit.
4. Drive the shell from the authenticated user's accessible workspaces; validate
   the selected brand on each request, never trust the selection cookie.
5. Test actual database allow/deny/revocation and idempotent onboarding; verify
   auth endpoints locally without sending mail to real recipients.
6. Run lint/types/build/tests and document deployment configuration requirements.

## Acceptance and failure cases

- No sample brand or observation can be displayed or exported.
- Unknown configuration, auth outages and database errors are explicit; no fallback
  to data from another account or claims of successful setup.
- Unauthenticated requests cannot create/read a workspace; spoofed selected IDs
  cannot select another user's brand. Revoked membership loses access immediately.
- Onboarding is atomic and resubmission with the same request ID is idempotent.
- No service-role credential is used in application requests. Browser sessions use
  publishable access plus user JWT and RLS.
- Login codes expire, provider rate limits apply, and resend cooldown is visible.
- Sign-out is a server mutation; cookies are refreshed through the Next.js proxy.

## Verification

Local verification, 2026-10-25:

- Isolated Supabase stack started; initial SQL migration applied successfully.
- 20 pgTAP checks passed against real Postgres: owner creation, idempotent retry,
  cross-user isolation, direct-write denial, capability escalation denial,
  anonymous/unconfirmed-user denial, brand/organization revocation, audit protection.
- Real local Auth test passed: issued OTP verification, verified identity, SSR
  cookie storage, new account with no seeds, OTP replay denial, sign-out and cleanup.
- Five web/worker tests passed. Corrected the pre-existing worker lifecycle test's
  subprocess working directory after unrestricted execution exposed it.
- Formatting, lint, strict type checks and production builds passed.
- No provider credentials, customer records or live integrations were fabricated.
- Browser verification remains pending because local browser access was previously
  denied. No claim is made that the rendered OTP/onboarding flow was browser-tested.
- CI now includes isolated database/auth tests; hosted CI has not been run.

Official references checked 2026-10-25:

- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/local-development/cli-workflows

Production requires a chosen Supabase project, configured email templates/SMTP,
reviewed abuse limits/CAPTCHA, applied migrations, and deployment environment vars.
