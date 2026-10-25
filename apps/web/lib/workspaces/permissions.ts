import "server-only";
import { requireUser } from "../auth/session";
export type BrandCapability =
  | "workspace.manage"
  | "integrations.connect"
  | "knowledge.write"
  | "knowledge.approve"
  | "opportunities.manage"
  | "reports.create";
export async function hasBrandCapability(
  brandId: string,
  capability: BrandCapability = "workspace.manage",
) {
  const { client } = await requireUser();
  const { data, error } = await client.rpc("current_brand_capability", {
    target_brand: brandId,
    capability,
  });
  if (error) throw new Error("Brand permissions could not be loaded.");
  return data;
}
