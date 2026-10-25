# Audits and observation cohorts

Status: in progress. No live AI key will be provisioned or exercised during build.

## Outcome and scope

INT-004–007: bounded same-origin website audits with inspectable evidence and
rechecks; explicit API observation cohorts with fixed questions, market/language,
subjects, model, sample count, freshness, and comparable valid-sample denominators.
A failed sample reduces coverage, never counts as brand absence. API observations
are clearly distinct from consumer-interface observations and measured demand.

## Safety and data boundaries

Audit requests pin validated public DNS addresses, reject private/reserved targets,
revalidate every redirect, respect robots.txt, cap pages/body/time and do not run
scripts. Only the saved brand website can be audited. Each check preserves evidence;
successful rechecks resolve findings without deleting history.

Observation requests use one configured model through OpenAI Responses, no tools,
no arbitrary endpoints, bounded input/output and explicit monthly request allowance
(default zero). No API key is inspected/reused/provisioned; configuration is deferred
by the user. Cohorts record permission attestation and requested geography; verified
geography stays null. Exact normalized text matching is an inspectable proxy, not
semantic attribution. Recommendations never gain authority from model output.

## Steps and checks

Add tenant-scoped runs/results and private transactional outbox, current actor
checks, quotas, immutable samples/checks and audit history; implement bounded
adapters/worker and real list/detail/setup screens. Verify SSRF denial at network
boundary, duplicate/revoked jobs, missing/failed denominators, and same-run
competitor comparison. Run database, integration and workspace checks. Live
provider, browser accessibility and customer acceptance stay release gates.

Sources: https://github.com/whitequark/ipaddr.js/ ; https://cheerio.js.org/docs/basics/loading/ ;
https://github.com/samclarke/robots-parser ;
https://developers.openai.com/api/reference/resources/responses/methods/create

## Local verification evidence (25 October 2026)

Implemented bounded public-address static audits, immutable checks and recheckable
findings; fixed observation cohorts, explicit request quotas, scheduled runs,
immutable responses, model/parser/surface metadata and same-run comparisons.
No consumer-interface collection or citation extraction is claimed.

Shared tests passed for private/reserved IP rejection, deterministic HTML findings
and exact subject matching. Real database tests passed for quota reservation,
idempotency, immutable evidence, cancellation, revocation and cross-tenant denial.
The isolated worker test passed interrupted-attempt handling: one uncertain prior
attempt is retained as unknown, only the other sample calls the intercepted
provider, and coverage remains partial. Live provider verification remains pending.
