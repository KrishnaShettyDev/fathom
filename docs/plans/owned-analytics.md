# Owned analytics

Status: in progress. Google OAuth app configuration is deferred.

## Outcome and scope

INT-003/CORE-008/009: authorize the exact entered Search Console or GA4 property,
verify access to that property, and collect 28 daily rows ending three days before
collection. Display provider timezone, date range, metric definitions, capture
freshness and missing dates. Google property discovery is not required to choose
an arbitrary account: an explicit property reference is mandatory and verified.

## Boundaries and failures

Reuse encrypted credentials, expiring actor/browser/source-bound OAuth state,
source-version fences, transactional run intent, quota and pg-boss worker. Only
readonly scopes. PKCE protects authorization codes. Token refresh is serialized
per source. Daily missing data is explicit null, never zero. Metadata marks
thresholding/sampling when returned by GA4. No revenue aggregation or currency
conversion, event writes, order ingestion or consumer AI observations.

## Implementation and verification

Add additive schema for date-scoped runs and daily observations; implement OAuth,
property verification, provider adapters, worker and analytics route. Test missing
rows, malformed metrics, property mismatch, scope/authority revocation and
idempotent daily upserts. Run database tests and workspace checks. Real provider
accuracy remains unverified until configured accounts are authorized.

## Primary references

- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/webmaster-tools/v1/searchanalytics/query
- https://developers.google.com/webmaster-tools/v1/sites/get
- https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties/get
- https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport

Changes are forward-only migrations; preserve historical observations on error or
disconnect. Existing reports remain immutable; future analytical report snapshots
must capture the actual selected observation rows and methodology.

## Local verification evidence (25 October 2026)

Google OAuth with PKCE verifies the explicitly registered property, stores encrypted
refreshable credentials and queues 28 provider-local dates. Daily metrics retain
missingness, timezone and provider metadata. No cross-date unique-user sum exists.

Normalization tests passed for explicit zero versus missing, duplicate dates,
wrong headers and bounds. Isolated worker/database integration persisted one real
transport-fixture zero and 27 unavailable dates. pgTAP verifies client write denial,
RLS, immutable report capture and the unavailable/null constraint. Real GSC/GA4
property verification and sampling/thresholded-account checks remain pending.
