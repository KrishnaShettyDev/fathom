import { getDatabase } from "@fathom/connectors";
import { z } from "zod";
import { requireUser } from "../../../../../lib/auth/session";
import {
  brandExport,
  ExportAccessError,
} from "../../../../../lib/exports/stream";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response("Not found", { status: 404 });
  const { user, client } = await requireUser();
  const permission = await client.rpc("current_brand_capability", {
    target_brand: id,
    capability: "workspace.manage",
  });
  if (permission.error || !permission.data)
    return new Response("Not found", { status: 404 });
  if (!process.env.DATABASE_URL)
    return new Response("Export server configuration is pending.", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  try {
    const stream = await brandExport(
      getDatabase(),
      user.id,
      id,
      request.signal,
    );
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Content-Disposition": `attachment; filename="fathom-brand-${id}.ndjson"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return new Response(
      error instanceof ExportAccessError ? "Not found" : "Export unavailable",
      {
        status: error instanceof ExportAccessError ? 404 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
