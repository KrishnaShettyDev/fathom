"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth/session";
import { workspaceSchema } from "../auth/validation";
export type SettingsState = { error: string; message?: string };
export async function saveSettings(
  _previous: SettingsState,
  form: FormData,
): Promise<SettingsState> {
  const input = workspaceSchema
    .pick({ brandName: true, website: true, timezone: true })
    .extend({ brandId: z.uuid() })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Check the name, website URL and timezone." };
  const { client } = await requireUser();
  const { error } = await client.rpc("update_brand_settings", {
    target_brand: input.data.brandId,
    brand_name: input.data.brandName,
    website_url: input.data.website,
    timezone_name: input.data.timezone,
  });
  if (error)
    return {
      error:
        "Settings could not be saved. Check your current brand permissions.",
    };
  revalidatePath("/", "layout");
  return {
    error: "",
    message:
      "Settings saved. Existing evidence and reports retain their original context.",
  };
}
export async function acknowledgeBaseline(
  _previous: SettingsState,
  form: FormData,
): Promise<SettingsState> {
  const text = z.string().trim().min(1).max(4000);
  const input = z
    .object({
      brandId: z.uuid(),
      requestId: z.uuid(),
      scope: text,
      gaps: text,
      responsibilities: text,
      confirm: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return {
      error:
        "Describe scope, gaps and responsibilities, then acknowledge this baseline.",
    };
  const { client } = await requireUser();
  const v = input.data;
  const { error } = await client.rpc("acknowledge_baseline", {
    target_brand: v.brandId,
    scope_text: v.scope,
    gaps_text: v.gaps,
    responsibility_text: v.responsibilities,
    creation_request_id: v.requestId,
    confirmed: true,
  });
  if (error)
    return {
      error:
        "Baseline review could not be saved. Check your current brand permissions.",
    };
  revalidatePath("/settings");
  revalidatePath("/");
  return {
    error: "",
    message:
      "Acknowledgement recorded with a fixed snapshot of current source health and evidence counts.",
  };
}
