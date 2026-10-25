"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "../auth/session";
export type SupportState = { error: string; message?: string };
export async function grantSupport(
  _previous: SupportState,
  form: FormData,
): Promise<SupportState> {
  const input = z
    .object({
      brandId: z.uuid(),
      email: z.email().max(254),
      purpose: z.string().trim().min(1).max(1000),
      access: z.enum(["analyst", "operator"]),
      hours: z.coerce.number().int().min(1).max(24),
      confirm: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return {
      error: "Check the recipient, purpose, access and duration, then confirm.",
    };
  const { client } = await requireUser();
  const v = input.data;
  const { error } = await client.rpc("grant_support_session", {
    target_brand: v.brandId,
    email_address: v.email,
    purpose_text: v.purpose,
    requested_access: v.access,
    duration_hours: v.hours,
  });
  if (error)
    return {
      error:
        "Support access could not be granted. The recipient must already have a verified account, and you must manage this brand.",
    };
  revalidatePath("/support");
  return {
    error: "",
    message: "Time-limited access granted. No invitation message was sent.",
  };
}
export async function revokeSupport(
  _previous: SupportState,
  form: FormData,
): Promise<SupportState> {
  const input = z
    .object({ brandId: z.uuid(), sessionId: z.uuid() })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Invalid session selection." };
  const { client } = await requireUser();
  const { error } = await client.rpc("revoke_support_session", {
    target_brand: input.data.brandId,
    support_session: input.data.sessionId,
  });
  if (error) return { error: "Support access could not be revoked." };
  revalidatePath("/support");
  return {
    error: "",
    message:
      "Session revoked. Other independently granted access, if any, still applies.",
  };
}
