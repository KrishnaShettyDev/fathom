"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "../auth/session";
export type CapabilityState = { error: string; message?: string };
export async function saveAgencyCapabilities(
  _previous: CapabilityState,
  form: FormData,
): Promise<CapabilityState> {
  const parsed = z
    .object({
      brandId: z.uuid(),
      grantId: z.uuid(),
      version: z.coerce.number().int().positive(),
      capabilities: z
        .array(
          z.enum([
            "knowledge.write",
            "knowledge.approve",
            "opportunities.manage",
            "reports.create",
          ]),
        )
        .max(4),
      confirm: z.literal("on"),
    })
    .safeParse({
      ...Object.fromEntries(form),
      capabilities: form.getAll("capabilities"),
    });
  if (!parsed.success)
    return {
      error: "Confirm the selected permissions for this agency and brand.",
    };
  const { client } = await requireUser();
  const v = parsed.data;
  const { error } = await client.rpc("set_agency_capabilities", {
    target_brand: v.brandId,
    access_grant: v.grantId,
    expected_version: v.version,
    requested_capabilities: v.capabilities,
  });
  if (error)
    return {
      error:
        "Permissions could not be saved. Reload if the grant changed or was revoked.",
    };
  revalidatePath("/team");
  return { error: "", message: "Agency workflow permissions updated." };
}
