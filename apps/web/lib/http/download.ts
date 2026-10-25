import "server-only";
import { randomUUID } from "node:crypto";
export function downloadResponseContext(route: "brand_export" | "report") {
  const headers = {
    "Cache-Control": "no-store",
    "X-Request-ID": randomUUID(),
  };
  function unavailable(
    stage: "auth" | "database" | "configuration" | "stream",
    message: string,
  ) {
    console.error(
      JSON.stringify({
        event: "download.unavailable",
        route,
        stage,
        request_id: headers["X-Request-ID"],
      }),
    );
    return new Response(message, { status: 503, headers });
  }
  return { headers, unavailable };
}
