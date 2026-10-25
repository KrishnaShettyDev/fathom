import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { publicAddress, fetchPublicPage, inspectHtml } from "./audit.js";
import { subjectMentions } from "./observations.js";
test("network boundary refuses local/private/reserved addresses, including mapped IPv6", async () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "::1",
    "::ffff:127.0.0.1",
    "fc00::1",
    "192.0.2.1",
  ])
    assert.equal(publicAddress(address), false);
  let reached = false;
  const server = createServer((_req, res) => {
    reached = true;
    res.end("private");
  });
  await new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(undefined)),
  );
  try {
    await assert.rejects(
      () => fetchPublicPage("http://127.0.0.1/", new AbortController().signal),
      /AUDIT_PRIVATE_ADDRESS/,
    );
    assert.equal(reached, false);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve(undefined))),
    );
  }
});
test("audit evidence is deterministic and does not execute source scripts", () => {
  const result = inspectHtml(
    "https://example.invalid/",
    200,
    Buffer.from(
      '<html><head><meta name="robots" content="noindex"></head><body><script>throw Error()</script><a href="/about">About</a><a href="https://other.invalid">External</a></body></html>',
    ),
  );
  assert.deepEqual(
    result.findings.map((f) => f.code),
    ["MISSING_TITLE", "MISSING_DESCRIPTION", "MISSING_H1", "NOINDEX"],
  );
  assert.deepEqual(result.links, ["https://example.invalid/about"]);
});
test("mention proxy preserves exact subjects and does not match within another word", () => {
  assert.deepEqual(
    subjectMentions("A pineapple, ACME and Brand+.", [
      "Apple",
      "Acme",
      "Brand+",
    ]),
    { Apple: false, Acme: true, "Brand+": true },
  );
});
