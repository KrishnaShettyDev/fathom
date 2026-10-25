# Local identity and database development

Use Node 24.22.1, npm 11.17.0 and a running Docker daemon.

```sh
npm ci
npm run db:start
npm run db:configure
npm run dev
```

`db:configure` creates the ignored `apps/web/.env.local` using only the local
Supabase URL and anon key. It refuses to overwrite an existing file. Do not put a
service-role key in the web environment. The app uses server-side, HTTP-only
session cookies and user-scoped database access.

Open http://localhost:3000. Request an email code on the sign-in page. In local
development, mail is captured at http://127.0.0.1:55434 instead of sent to external
recipients. Enter the code, create your organization's brand workspace, and reload
to confirm it was saved. There are no seeded brands, products, or measurements.

Ports: API 55431; database 55432; captured mail 55434. The project ID is `fathom`.
The isolated stack does not modify other running Docker projects.
`npm run db:stop` stops this project's services without deleting stored data.
Do not run `supabase db reset` against useful local data; it is destructive.

## Verification

```sh
npm run db:test     # Transactional pgTAP checks against real Postgres/RLS
npm run test:auth   # Local OTP, cookies, empty account, replay and sign-out
npm run db:types    # Regenerate from migrated schema, only on successful output
npm run check      # Formatting, lint, types, web/worker tests and builds
```

Database tests create test-only principals inside a rolled-back transaction.
The auth test allows only loopback Supabase, creates one temporary test principal,
and deletes it afterward. It never sends external email or seeds business data.
The test runner's local admin credential is held in memory, not in app code.

## Hosted configuration

Choose a Supabase project and data region explicitly. Apply the SQL migration
through a reviewed migration deployment, then configure `SUPABASE_URL` and
`SUPABASE_PUBLISHABLE_KEY` in the web runtime. The example lives in
`apps/web/.env.example`; these variables are server-only in this app.

Set both the confirmation and magic-link templates to include `{{ .Token }}`;
use `supabase/templates/otp.html` as the template. Configure six-digit OTPs with
600-second expiry and a 60-second resend interval. Configure custom SMTP and
appropriate production rate limits/CAPTCHA before public signups. Local mail
capture and local rate limits are development settings, not production delivery.

Set the Auth site URL to the real deployment origin; cookies use `Secure` in
production. Review proxy trust and Next.js Server Action allowed origins for the
deployment. Session refresh and protected responses must never be publicly cached.

This slice supports owner-created workspaces only. Agency invitations and claims,
connector credentials, live source ingestion, billing, support access and privacy
lifecycle operations remain separate release requirements. A logged-in workspace
is not proof of ownership of any external account.

## Migration operations

The first migration only adds schemas, tables, policies, and the onboarding RPC.
For an existing environment apply new migrations forward; never edit an applied
migration. Before deployment, take a backup and validate the migration against
staging. Roll application code forward with compatible schema; dropping identity
tables would delete workspace ownership history and is not an automatic rollback.

References:

- https://supabase.com/docs/guides/auth/server-side/creating-a-client
- https://supabase.com/docs/guides/auth/auth-email-passwordless
- https://supabase.com/docs/guides/local-development/cli-workflows
