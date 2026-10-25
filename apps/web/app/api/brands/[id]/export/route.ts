import { downloadResponseContext } from "../../../../../lib/http/download";
import { getDatabase } from "@fathom/connectors";
import { z } from "zod";
import { createSupabaseClient } from "../../../../../lib/supabase/server";
import {
  brandExport,
  ExportAccessError,
} from "../../../../../lib/exports/stream";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { headers: responseHeaders, unavailable } =
    downloadResponseContext("brand_export");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response("Not found", {
      status: 404,
      headers: responseHeaders,
    });
  const client = await createSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError?.status && authError.status >= 500)
    return unavailable("auth", "Sign-in service unavailable");
  if (authError || !user)
    return new Response("Authentication required", {
      status: 401,
      headers: responseHeaders,
    });
  const permission = await client.rpc("current_brand_capability", {
    target_brand: id,
    capability: "workspace.manage",
  });
  if (permission.error) return unavailable("database", "Export unavailable");
  if (!permission.data)
    return new Response("Not found", {
      status: 404,
      headers: responseHeaders,
    });
  if (!process.env.DATABASE_URL)
    return unavailable(
      "configuration",
      "Export server configuration is pending.",
    );
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
        ...responseHeaders,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof ExportAccessError)
      return new Response("Not found", {
        status: 404,
        headers: responseHeaders,
      });
    return unavailable("stream", "Export unavailable");
  }
}
