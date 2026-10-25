import { parsePort } from "./config.js";
import { createHealthServer } from "./server.js";

const port = parsePort(process.env.PORT);
const server = createHealthServer();

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
    JSON.stringify({ event: "worker.started", port, queue: "not_configured" }),
  );
});

let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => {
    console.error(JSON.stringify({ event: "worker.shutdown_timeout" }));
    process.exit(1);
  }, 10_000);
  deadline.unref();
  server.close((error) => {
    clearTimeout(deadline);
    if (error) process.exitCode = 1;
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
