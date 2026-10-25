import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { parsePort } from "./config.js";
import { createHealthServer } from "./server.js";

test("invalid ports fail before a worker starts", () => {
  assert.equal(parsePort(undefined), 3001);
  assert.equal(parsePort("8080"), 8080);
  for (const value of [
    "",
    "0",
    "-1",
    "65536",
    "3.5",
    "3001oops",
    " 80",
    "Infinity",
  ]) {
    assert.throws(() => parsePort(value), /PORT must be/);
  }
});

test("liveness discloses unconfigured queues and rejects unrelated routes", async (t) => {
  const server = createHealthServer();
  t.after(
    () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  );
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const health = await fetch(`${base}/healthz`);
  assert.equal(health.status, 200);
  assert.equal(health.headers.get("cache-control"), "no-store");
  assert.deepEqual(await health.json(), {
    status: "ok",
    service: "worker",
    queue: "not_configured",
  });
  assert.equal((await fetch(`${base}/private`)).status, 404);
  const mutation = await fetch(`${base}/healthz`, { method: "POST" });
  assert.equal(mutation.status, 405);
  assert.equal(mutation.headers.get("allow"), "GET");
});
