# Brand knowledge

Status: implemented and database-verified locally. External provider configuration
is deferred at user request.

## Outcome and requirements

Brand managers capture real facts with sources and review dates, correct them with
version history, and explicitly approve or archive the current version. Readers
including scoped agencies can inspect provenance. Supports INT-002 and Phase One
knowledge; does not complete dependent draft/recommendation impact tracking.

## Non-goals and boundaries

No generated facts, seeded business content, source fetching, file ingestion,
connector configuration, or autonomous approval. Agency grants remain read-only
for knowledge; workspace managers own edits and approval. Next server actions use
the verified session; Postgres enforces tenant access, optimistic version checks,
immutable revisions, and transactional audit events. No new dependency.

## Acceptance and failure cases

- Source description, responsible owner, category, fact and review date required.
- Creation and correction produce pending facts. Approval applies to an exact
  revision and cannot approve a past review date. Archive also targets a revision.
- Concurrent stale edits fail without overwriting; retry creation is idempotent.
- Read access follows current brand authority; direct table writes are denied.
- History is append-only and cross-brand selectors cannot mutate records.
- Lists are bounded and paginated; empty data remains empty.

## Ordered steps

1. Add facts, immutable revisions, RLS and audited create/revise/review RPCs.
2. Add typed validation/query/action modules and database-backed knowledge pages.
3. Add real database tests for history, stale versions, approvals, tenant isolation,
   revoked authority and mutation denial. Generate types and inspect final diff.
4. Run db:test, check and test:auth; record remaining release gates.

## Verification and recovery

Pending. Use forward-only migrations; preserve fact history and audit records.
Browser verification remains unavailable under the previous local access denial.
Provider setup and live connector verification remain deferred, not completed.

## Evidence and remaining work

- Additive migrations applied to the existing local schema; generated Supabase
  types refreshed. Creation has a separate typed RPC so nullable selectors are
  not forced through generated non-null argument types.
- `npm run db:test`: 84 assertions passed (31 knowledge, 33 agency, 20 identity).
  Knowledge coverage includes exact-version approval, stale-edit rejection,
  corrections clearing approval, overdue approval denial, immutable provenance,
  read-only agencies, cross-brand denial and membership revocation.
- `npm run check`: formatting, lint, type checking, five existing unit/lifecycle
  tests, Next production build and worker build passed. An initial TypeScript
  nullable-RPC mismatch was resolved with a forward migration; an intermediate
  formatting failure was corrected before the successful full run.
- `npm run test:auth`: local OTP/session/replay/sign-out integration passed.
- `git diff --check` passed. Post-test fact count is zero; fixtures rolled back.
- React review: independent reads run concurrently; mutations reauthenticate;
  controlled review confirmation targets a displayed version; inputs are labeled,
  errors announced, pending submissions disabled, and detail/history are paginated.

Browser and knowledge-specific HTTP interaction tests remain unverified. Genuine
simultaneous transaction tests and fresh-database migration rehearsal remain
release gates. Current tests prove stale-version rejection at the real database.
History shows human-readable provenance, while audit retains actor IDs. Review
dates are UTC dates; future consumers must require approved state AND a current
review date. Corrections invalidate approval but dependency impact tracking awaits
real drafts and recommendations. Owner authority is deliberately required for all
knowledge writes; agency operators only read. No source URL is fetched by servers.
