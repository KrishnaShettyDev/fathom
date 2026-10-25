import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDaily, propertyReference, dateRange } from "./google.js";
test("missing daily dates remain unavailable while explicit zero remains zero", () => {
  const rows = normalizeDaily(
    "gsc",
    {
      rows: [
        {
          keys: ["2026-01-01"],
          clicks: 0,
          impressions: 10,
          ctr: 0,
          position: 3,
        },
      ],
    },
    "2026-01-01",
    "2026-01-02",
  );
  assert.equal(rows[0]?.metrics?.clicks, 0);
  assert.equal(rows[1]?.metrics, null);
});
test("analytics rejects wrong headers, duplicate dates and unbounded ranges", () => {
  assert.throws(() =>
    normalizeDaily(
      "ga4",
      { dimensionHeaders: [{ name: "country" }] },
      "2026-01-01",
      "2026-01-02",
    ),
  );
  assert.throws(() => dateRange("2026-01-01", "2026-03-01"));
  assert.throws(() =>
    normalizeDaily(
      "gsc",
      {
        rows: [
          {
            keys: ["2026-02-01"],
            clicks: 1,
            impressions: 1,
            ctr: 1,
            position: 1,
          },
        ],
      },
      "2026-01-01",
      "2026-01-02",
    ),
  );
  assert.equal(
    propertyReference("gsc", "https://example.invalid/CaseSensitive/"),
    "https://example.invalid/CaseSensitive/",
  );
  assert.throws(() => propertyReference("ga4", "123"));
});
