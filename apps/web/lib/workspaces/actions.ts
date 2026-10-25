"use server";
import { cookies } from "next/headers";
import { selectBrandCookie } from "./selection";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "../auth/session";
import { workspaceSchema, type FormState } from "../auth/validation";

export async function createWorkspace(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const input = workspaceSchema.safeParse(Object.fromEntries(form.entries()));
  if (!input.success)
    return {
      error: "Check the names, website, timezone, and ownership confirmation.",
    };
  const { client } = await requireUser();
  const { data, error } = await client.rpc("create_owner_workspace", {
    organization_name: input.data.organizationName,
    brand_name: input.data.brandName,
    timezone_name: input.data.timezone,
    website_url: input.data.website,
    onboarding_request_id: input.data.requestId,
    owner_attested: true,
  });
  if (error)
    return {
      error:
        "The workspace could not be saved. Please retry; repeated submissions won’t create duplicates.",
    };
  await selectBrandCookie(data);
  redirect("/");
}
export async function switchWorkspace(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const id = z.uuid().safeParse(form.get("brandId"));
  if (!id.success) return { error: "Choose a workspace." };
  const { client } = await requireUser();
  const { data, error } = await client
    .from("brand_workspaces")
    .select("id")
    .eq("id", id.data)
    .maybeSingle();
  if (error || !data)
    return {
      error: "This workspace is unavailable or your access has changed.",
    };
  await selectBrandCookie(data.id);
  redirect("/");
}
export async function clearWorkspaceSelection() {
  await requireUser();
  (await cookies()).delete("fathom-brand");
  redirect("/");
}
