import "server-only";
import { requireUser } from "../auth/session";
import { cursorFilter, readCursor, type PageParams } from "../agency/queries";
export async function getSources(brandId: string, params: PageParams) {
  const { client } = await requireUser();
  const cursor = readCursor(params);
  let query = client
    .from("brand_sources")
    .select("*")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(26);
  if (cursor) query = query.or(cursorFilter(cursor));
  const [sources, permission] = await Promise.all([
    query,
    client.rpc("current_brand_capability", {
      target_brand: brandId,
      capability: "integrations.connect",
    }),
  ]);
  if (sources.error || permission.error)
    throw new Error("Source accounts could not be loaded.");
  return {
    rows: sources.data.slice(0, 25),
    hasMore: sources.data.length > 25,
    canConnect: permission.data,
  };
}
