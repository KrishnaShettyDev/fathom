# Agency-started brand claims

Status: in progress.

## Outcome and scope

CORE-004 and Part 6 decision 4: agencies save an explicitly unclaimed client setup
request. The named recipient signs in with verified OTP and attests ownership
before an owner workspace exists. Credentials and email-domain matching never
establish ownership. The owner separately grants agency access after claiming.

No data import before claim, ownership transfer of existing brands, automatic
conflict resolution or outgoing invitation emails. Disputed requests stop; a
human must resolve identity/contract conflicts outside this grant mechanism.

## Boundaries and decisions

Reuse owner workspace creation, verified-email matching and agency-admin predicates.
A pending setup record has no owner privileges or access to an existing brand.
Accepted requests reference the newly owner-created workspace. An immutable ledger
records creation, claim, cancellation and dispute. Reject expired/replayed requests
and revoked creator authority. Serialize acceptance with the request row lock.

## Acceptance and steps

1. Persist unclaimed setup and recipient-scoped read policies.
2. Add creator, recipient accept/decline/dispute flows with exact context.
3. Test wrong recipient, attestation, expiry, revocation, replay, owner identity,
   and absence of implicit agency access at the database enforcement layer.
4. Run full checks and fresh migrations. Provider/customer verification is separate.

## Local evidence

Implemented unclaimed setup requests, exact verified-recipient acceptance,
independent owner attestation, explicit dispute/cancel reasons and audited closure.
No implicit agency access is retained after claim. Eighteen pgTAP assertions pass
for identity, attestation, expiry, replay, dispute and revoked creator authority.
This prepares a new owner workspace; existing ownership disputes need human
resolution and never trigger automatic transfer or merging of customer data.
