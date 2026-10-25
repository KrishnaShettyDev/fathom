import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { requireUser } from "../auth/session";
export const getWorkspaceContext = cache(async () => {
  const { client, user } = await requireUser();
  const { data: brands, error } = await client
    .from("brand_workspaces")
    .select("id,name,website,reporting_timezone,created_at")
    .order("created_at");
  if (error)
    throw new Error(
      "Your workspaces could not be loaded. Check database availability and migrations.",
    );
  const selectedId = (await cookies()).get("fathom-brand")?.value;
  const activeBrand = selectedId
    ? (brands.find((brand) => brand.id === selectedId) ?? null)
    : (brands[0] ?? null);
  return {
    brands,
    activeBrand,
    email: user.email ?? "Signed-in user",
    selectionDenied: !!selectedId && !activeBrand,
  };
});
