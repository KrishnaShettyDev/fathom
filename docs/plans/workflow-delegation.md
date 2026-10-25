# Delegated intelligence workflows

Status: in progress.

## Outcome and scope

CORE-002/004 and INT-008/009: owners independently grant an existing agency
knowledge editing, fact approval, opportunity management and report creation.
No owner, billing, quota, support or billable research delegation. Connection
operator access remains its separate existing grant. Assignment lists current
brand members and agency staff; server checks authority again on mutation.

## Inspection and decisions

Reuse current capability predicate and immutable fact/report/history RPCs. Add
explicit capabilities to brand agency grants, default empty. Owners retain these
four capabilities by their existing workspace.manage authority. No role name
implicitly approves facts. Grant updates require exact permission version.

## Acceptance and failure cases

Editor may propose/correct but cannot approve. Report creator cannot change facts.
Revoked agency/grantee loses mutation and assignment eligibility immediately.
Owners can see only eligible assignee identities for their selected brand.

## Ordered implementation

1. Add audited, versioned grant capabilities and update enforcement RPCs.
2. Reflect current capabilities in each screen without granting client authority.
3. Add grant editor and current-member assignment choices.
4. Test separation, revocation, stale grant version and cross-brand denial.

## Verification

npm run db:test, npm run test:migrations, npm run check. Additive migrations only.

## Local evidence

Implemented independent grant controls, exact permission-version checks, separate
editor/approver screens, report/opportunity delegation and current-member assignment.
Re-inviting a revoked agency clears old delegated capabilities. The delegation
pgTAP suite passes 26 assertions, including staff access and revocation. Full
repository checks pass; live multi-user browser acceptance remains unverified.
