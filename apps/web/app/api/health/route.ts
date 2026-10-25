// Process liveness only. Database and connector readiness are separate checks.
export function GET() {
  return Response.json(
    { status: "ok", service: "web" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
