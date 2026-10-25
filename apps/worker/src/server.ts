import { createServer } from "node:http";

export function createHealthServer() {
  return createServer((request, response) => {
    if (request.url !== "/healthz") {
      response.writeHead(404).end();
      return;
    }
    if (request.method !== "GET") {
      response.writeHead(405, { Allow: "GET" }).end();
      return;
    }
    // Liveness does not claim that queues or provider integrations are ready.
    response.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(
      JSON.stringify({
        status: "ok",
        service: "worker",
        queue: "not_configured",
      }),
    );
  });
}
