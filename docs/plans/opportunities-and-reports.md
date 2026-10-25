# Opportunities and reports

Status: in progress; part of Phase One completion.

## Scope

INT-002/005/008/009: create evidence-backed opportunities from a recorded brand
fact, explain confidence/effort/relevance, assign current members, prioritize,
comment, snooze, dismiss, reopen and mark work in progress/completed. Versioned
state and immutable events prevent silent overwrites. Corrections to supporting
facts invalidate the opportunity's reviewed-evidence marker.

Reports snapshot the selected UTC creation-date range of opportunities plus their
referenced fact revisions, state, comments, source availability and annotations.
Snapshots are immutable and exports recheck current tenant access. This is a
workflow report, not invented analytics; missing measurements remain unavailable.

## Non-goals

No revenue predictions, generated recommendations, sending reports to third
parties, provider ingestion or publishing. No arbitrary JSON snapshots from users.

## Steps and verification

1. Add RLS-protected opportunities/comments/events/reports with audited RPCs.
2. Implement database-backed list/detail/forms and authenticated JSON download.
3. Test tenant isolation, stale writes, assignee validity, snooze bounds, fact
   invalidation, immutable snapshots and revoked export authority.
4. Run db:test/check and record limits. Keep reports bounded: reject oversized
   exports explicitly, never silently truncate their stated range.

## Local verification evidence (25 October 2026)

Opportunity exact-version fact references, corrections/review flags, workflow
states, manual priority, comments and history are persisted. Assignment now lists current brand and agency members (up to 100) and rechecks
eligibility at mutation. Delegated opportunity/report permissions are independent.
Reports now use schema v2 and capture filtered daily analytics, research run
methodology/raw evidence, opportunity revisions and history in one MVCC snapshot.
Downloads authenticate and reapply current report RLS; snapshots remain immutable.

pgTAP passed stale-fact, invalid transition, approval, role/isolation and snapshot
immutability tests, including an analytics refresh after capture. Browser/export
HTTP tenant coverage still needs expansion beyond local auth and database tests.
