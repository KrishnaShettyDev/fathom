import { downloadResponseContext } from "../../../../../lib/http/download";
import { z } from "zod";
import { createSupabaseClient } from "../../../../../lib/supabase/server";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { headers: responseHeaders, unavailable } =
    downloadResponseContext("report");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response("Not found", { status: 404, headers: responseHeaders });
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
  const { data, error } = await client
    .from("client_reports")
    .select("id,title,range_start,range_end,annotation,created_at,snapshot")
    .eq("id", id)
    .maybeSingle();
  if (error) return unavailable("database", "Report unavailable");
  if (!data)
    return new Response("Not found", {
      status: 404,
      headers: responseHeaders,
    });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="fathom-report-${id}.json"`,
      ...responseHeaders,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
