import { startQueues } from "./queue.js";
import { parsePort } from "./config.js";
import { createHealthServer } from "./server.js";

const port = parsePort(process.env.PORT);
let queues: Awaited<ReturnType<typeof startQueues>> = null;
try {
  queues = await startQueues();
} catch {
  console.error(JSON.stringify({ event: "worker.queue_start_failed" }));
  process.exit(1);
}
const server = createHealthServer(queues ? "configured" : "not_configured");

server.on("error", (error: NodeJS.ErrnoException) => {
  console.error(
    JSON.stringify({
      event: "worker.start_failed",
      code: error.code ?? "UNKNOWN",
    }),
  );
  process.exitCode = 1;
});
server.listen(port, "0.0.0.0", () => {
  console.info(
    JSON.stringify({
      event: "worker.started",
      port,
      queue: queues ? "configured" : "not_configured",
    }),
  );
});

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => {
    console.error(JSON.stringify({ event: "worker.shutdown_timeout" }));
    process.exit(1);
  }, 10_000);
  deadline.unref();
  await queues?.stop();
  server.close((error) => {
    clearTimeout(deadline);
    if (error) process.exitCode = 1;
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
