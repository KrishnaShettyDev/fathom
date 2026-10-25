"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "../auth/session";
import { selectBrandCookie } from "../workspaces/selection";
import {
  agencySchema,
  invitationSchema,
  acceptanceSchema,
  accessTargetSchema,
  type AgencyFormState,
} from "./validation";

export async function createAgency(
  _previous: AgencyFormState,
  form: FormData,
): Promise<AgencyFormState> {
  const input = agencySchema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Enter an agency name of 1–120 characters." };
  const { client } = await requireUser();
  const { error } = await client.rpc("create_agency", {
    agency_name: input.data.name,
    creation_request_id: input.data.requestId,
  });
  if (error)
    return {
      error: "Agency could not be saved. Check your access and try again.",
    };
  revalidatePath("/agency");
  return {
    error: "",
    message:
      "Agency saved. You can now accept a brand invitation for this agency.",
  };
}
export async function createInvitation(
  _previous: AgencyFormState,
  form: FormData,
): Promise<AgencyFormState> {
  const input = invitationSchema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return {
      error: "Enter a valid recipient email and choose an access level.",
    };
  const { client } = await requireUser();
  const { error } = await client.rpc("create_brand_invitation", {
    target_brand: input.data.brandId,
    email_address: input.data.email,
    requested_access: input.data.access,
    invitation_request_id: input.data.requestId,
  });
  if (error)
    return {
      error:
        error.code === "23505"
          ? "This email already has a pending invitation. Cancel it before changing access."
          : "Invitation could not be created. Your permission may have changed; refresh and try again.",
    };
  revalidatePath("/team");
  return {
    error: "",
    message: `Invitation created for ${input.data.email}. No email was sent. They can sign in with this address and open Invitations. The invitation expires in seven days.`,
  };
}
export async function acceptInvitation(
  _previous: AgencyFormState,
  form: FormData,
): Promise<AgencyFormState> {
  const input = acceptanceSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Choose an agency you administer." };
  const { client } = await requireUser();
  const { data, error } = await client.rpc("accept_brand_invitation", {
    invitation: input.data.invitationId,
    agency: input.data.agencyId,
  });
  if (error)
    return {
      error:
        "This invitation cannot be accepted. Check the signed-in email, expiry, agency access and whether it has already been used.",
    };
  await selectBrandCookie(data);
  revalidatePath("/", "layout");
  redirect("/");
}
export async function cancelInvitation(
  _previous: AgencyFormState,
  form: FormData,
): Promise<AgencyFormState> {
  const input = accessTargetSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Invalid invitation selection." };
  const { client } = await requireUser();
  const { error } = await client.rpc("cancel_brand_invitation", {
    target_brand: input.data.brandId,
    invitation: input.data.targetId,
  });
  if (error)
    return {
      error:
        "Invitation could not be cancelled. Refresh to check its current state and your access.",
    };
  revalidatePath("/team");
  return { error: "", message: "Invitation cancelled." };
}
export async function revokeAgencyAccess(
  _previous: AgencyFormState,
  form: FormData,
): Promise<AgencyFormState> {
  const input = accessTargetSchema.safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Invalid agency selection." };
  if (form.get("confirm") !== "on")
    return { error: "Confirm revocation for this brand and agency." };
  const { client } = await requireUser();
  const { error } = await client.rpc("revoke_agency_access", {
    target_brand: input.data.brandId,
    access_grant: input.data.targetId,
  });
  if (error)
    return {
      error:
        "Access could not be revoked. Refresh to check your current permissions.",
    };
  revalidatePath("/team");
  return {
    error: "",
    message:
      "Agency access revoked. Further database requests are blocked; the brand and its data remain intact.",
  };
}
