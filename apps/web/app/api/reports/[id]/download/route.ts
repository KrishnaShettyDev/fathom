import { z } from "zod";
import { createSupabaseClient } from "../../../../../lib/supabase/server";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return new Response("Not found", { status: 404 });
  const client = await createSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError || !user)
    return new Response("Authentication required", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  const { data, error } = await client
    .from("client_reports")
    .select("id,title,range_start,range_end,annotation,created_at,snapshot")
    .eq("id", id)
    .maybeSingle();
  if (error)
    return new Response("Report unavailable", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  if (!data)
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "no-store" },
    });
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="fathom-report-${id}.json"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
