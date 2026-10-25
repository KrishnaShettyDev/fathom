import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { test } from "node:test";

// Reserve an ephemeral port for the subprocess without assuming a free fixed port.
async function availablePort(): Promise<number> {
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const address = probe.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve, reject) => {
    probe.close((error) => (error ? reject(error) : resolve()));
  });
  return address.port;
}

test("worker terminates cleanly on SIGTERM", { timeout: 15_000 }, async (t) => {
  const port = await availablePort();
  const child = spawn(process.execPath, ["--import", "tsx", "src/index.ts"], {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => {
    if (child.exitCode === null) child.kill("SIGKILL");
  });
  const exit = once(child, "exit");
  const ready = new Promise<void>((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", () => reject(new Error("Worker exited before startup")));
    child.stdout.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes('"worker.started"')) resolve();
    });
  });
  await ready;
  assert.equal((await fetch(`http://127.0.0.1:${port}/healthz`)).status, 200);
  child.kill("SIGTERM");
  const [code, signal] = await exit;
  assert.equal(code, 0);
  assert.equal(signal, null);
});
