"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "../auth/session";
import { workspaceSchema } from "../auth/validation";
import { selectBrandCookie } from "../workspaces/selection";
export type ClaimState = { error: string; message?: string };
export async function createClaim(
  _previous: ClaimState,
  form: FormData,
): Promise<ClaimState> {
  const input = workspaceSchema
    .pick({ brandName: true, website: true, timezone: true, requestId: true })
    .extend({
      agency: z.uuid(),
      email: z.email().max(254),
      confirm: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return {
      error:
        "Check brand, recipient, website and timezone, then attest authorization.",
    };
  const { client } = await requireUser();
  const v = input.data;
  const { error } = await client.rpc("create_brand_claim_request", {
    agency: v.agency,
    proposed_name: v.brandName,
    recipient_email: v.email,
    website_url: v.website,
    timezone_name: v.timezone,
    creation_request_id: v.requestId,
    authorized: true,
  });
  if (error)
    return {
      error:
        "Request could not be saved. Check agency administration and the pending-request allowance.",
    };
  revalidatePath("/claims");
  return {
    error: "",
    message:
      "Unclaimed setup saved. The named owner must sign in and attest ownership. No email was sent.",
  };
}
export async function acceptClaim(
  _previous: ClaimState,
  form: FormData,
): Promise<ClaimState> {
  const input = z
    .object({
      id: z.uuid(),
      organization: z.string().trim().min(1).max(120),
      confirm: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return {
      error: "Enter the owner organization and explicitly attest ownership.",
    };
  const { client } = await requireUser();
  const { data, error } = await client.rpc("accept_brand_claim_request", {
    claim_request: input.data.id,
    owner_organization_name: input.data.organization,
    owner_attested: true,
  });
  if (error)
    return {
      error:
        "Claim unavailable. Check recipient identity, expiry and whether it is already closed.",
    };
  await selectBrandCookie(data);
  revalidatePath("/", "layout");
  redirect("/team");
}
export async function closeClaim(
  _previous: ClaimState,
  form: FormData,
): Promise<ClaimState> {
  const input = z
    .object({
      id: z.uuid(),
      decision: z.enum(["cancelled", "disputed"]),
      reason: z.string().trim().min(1).max(2000),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Choose a decision and provide a reason." };
  const { client } = await requireUser();
  const { error } = await client.rpc("close_brand_claim_request", {
    claim_request: input.data.id,
    decision: input.data.decision,
    reason: input.data.reason,
  });
  if (error)
    return {
      error: "Request could not be closed. Check access and current state.",
    };
  revalidatePath("/claims");
  return {
    error: "",
    message:
      "Request closed. A dispute cannot transfer ownership; resolve identity and authorization with the parties before starting a new request.",
  };
}
