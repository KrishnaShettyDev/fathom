# Agency access and invitations

Status: implemented locally; release verification remains incomplete.

## Outcome and scope

A brand owner creates an email-bound invitation, the verified recipient accepts
for an agency they administer, and the owner can revoke the agency's access.
Agency organizations remain separate from brand ownership and billing. Implements
a bounded part of CORE-001/002/004/005 and Phase One identity/tenancy.

Invitations are in-app records, not emails. The UI must say no email was sent.
No account/credential transfer, agency-created brand claims, support sessions,
agency staff invitations, vendor connections or queued jobs in this slice.

## Inspected boundaries

Existing owner-only SQL RLS, Supabase SSR sessions, server actions, workspace
selection, and the Fathom shell are reused. Extend with an additive migration;
never edit the applied identity migration. Initial commit CI passed.

## Ordered implementation

1. Add agency organization identities, bounded grants and expiring invitations.
2. Extend the private access predicate to require current agency membership and
   an active grant. Agency roles never include brand management or ownership.
3. Implement transactional, audited create/accept/cancel/revoke RPCs. Acceptance
   checks current verified email, agency administration, expiry and inviter authority.
4. Add real database-backed agency setup, invitations and brand access screens.
5. Test two agencies sharing a brand plus an unrelated brand, wrong recipient,
   expired/cancelled/replayed invites, revoked inviter/agency/member, escalation,
   idempotent creation, cross-brand selectors and read visibility.
6. Regenerate schema types, run all checks, inspect the diff and update status.

## Acceptance and failure behavior

- Unauthorized actions fail in Postgres even if UI/server checks are bypassed.
- An invitation alone does not grant brand-data access.
- Only a verified matching email can accept; UUID knowledge is not authority.
- A recipient can accept only for an agency they administer. Credentials or email
  domains do not prove brand ownership; ownership never changes on acceptance.
- Read-only and connection-operator permissions are explicit and bounded.
- Cancellation/expiry/revoked inviter blocks pending acceptance. Revocation blocks
  subsequent database reads, including with an existing session token.
- Duplicate submissions do not create duplicate agencies, invitations or grants.
- Rows link brand-scoped references with composite keys where appropriate.
- No business data is seeded. Tests roll back their own isolated records.

## Verification

Commands and evidence are recorded below. Database tests cover the enforcement
layer; agency-specific HTTP and browser verification remain pending. Email
delivery and worker revocation checks remain explicit future release gates.

## Local implementation evidence

Implemented agency creation, seven-day email-bound in-app invitations, acceptance,
cancellation, scoped analyst/operator grants and confirmed revocation. Every write
runs through a verified-user RPC; current organization membership and grant state
control brand RLS. Ownership does not change. Invitations and grants use cursor
pagination; the agency picker currently shows the first 100 administered agencies.

- `npx supabase migration up --local`: additive migration applied to the existing
  local identity schema; `npm run db:types` regenerated the application types.
- `npm run db:test`: 53 assertions passed (33 agency, 20 owner identity), including
  two agencies sharing a brand, unrelated-brand isolation, recipient checks,
  role escalation, invitation replay/expiry/cancellation, revoked inviter,
  revoked membership/grants and cross-brand foreign keys. Fixtures rolled back.
- `npm run check`: formatting, lint, TypeScript, five existing unit/lifecycle tests,
  Next production build and worker build passed. Initial lint flagged render-time
  clock reads; screens now display persisted invitation state and explicit expiry,
  with acceptance evaluated against the database clock.
- `npm run test:auth`: real local OTP, verified identity, SSR cookies, empty
  account, replay rejection and sign-out passed.
- `git diff --check` passed. Post-test database counts remained zero for brands,
  agencies and invitations; no application fixtures remain.
- React review: server-side reads, independently authenticated actions, parallel
  independent queries, labeled fields, pending/error feedback and native dialog.

Not release-ready: agency HTTP authorization and browser interaction tests,
concurrent transaction tests, fresh-database migration rehearsal, email delivery,
agency staffing/claims and queued-work revocation remain outstanding. No connector
or external account has been connected. No business records were seeded.

Roll forward with a new migration if a defect is found. Do not edit this applied
migration or drop access/audit records to recover. Disable new invitations at the
application entry point while investigating; preserve existing grants and history.

## Agency staffing extension

CORE-002/004: agency administrators invite staff through expiring in-app invitations.
The verified recipient accepts membership; no email is sent. Agency staff inherit
only each brand's current agency grant. Admin can revoke staff except the agency
creator. Membership revocation must block RLS and queued connector work immediately.
Audit invitation/acceptance/revocation in an append-only agency event ledger.
Implement schema/RPCs, then admin staffing and recipient screens, then real pgTAP
allow/deny/expiry/revocation tests. No ownership transfer or agency-admin delegation.

Staffing is now implemented with in-app expiring invitations, verified acceptance,
admin-only roster and revocation, and append-only agency events. Delegation tests
prove inherited brand permissions disappear on staff revocation, including queued
work. Claim requests and granular workflow permissions have separate plans. Initial
"staffing/claims unfinished" notes above describe the earlier milestone only.
