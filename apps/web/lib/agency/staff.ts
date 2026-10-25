"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "../auth/session";
export type StaffState = { error: string; message?: string };
export async function inviteStaff(
  _previous: StaffState,
  form: FormData,
): Promise<StaffState> {
  const input = z
    .object({
      agency: z.uuid(),
      email: z.email().max(254),
      confirm: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Enter a valid email and confirm this agency invitation." };
  const { client } = await requireUser();
  const { error } = await client.rpc("invite_agency_staff", {
    agency: input.data.agency,
    email_address: input.data.email,
  });
  if (error)
    return {
      error:
        "Invitation could not be saved. Agency administration is required.",
    };
  revalidatePath(`/agency/${input.data.agency}/staff`);
  return {
    error: "",
    message: "In-app invitation saved for seven days. No email was sent.",
  };
}
export async function changeStaff(
  _previous: StaffState,
  form: FormData,
): Promise<StaffState> {
  const input = z
    .discriminatedUnion("operation", [
      z.object({ operation: z.literal("accept"), id: z.uuid() }),
      z.object({
        operation: z.literal("cancel"),
        id: z.uuid(),
        agency: z.uuid(),
      }),
      z.object({
        operation: z.literal("revoke"),
        id: z.uuid(),
        agency: z.uuid(),
        confirm: z.literal("on"),
      }),
    ])
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Check the selected action and required confirmation." };
  const { client } = await requireUser();
  const v = input.data;
  const result =
    v.operation === "accept"
      ? await client.rpc("accept_agency_staff", { invitation: v.id })
      : v.operation === "cancel"
        ? await client.rpc("cancel_agency_staff_invitation", {
            agency: v.agency,
            invitation: v.id,
          })
        : await client.rpc("revoke_agency_staff", {
            agency: v.agency,
            staff_user: v.id,
          });
  if (result.error)
    return {
      error:
        "Action unavailable. The invitation may have expired or your permissions changed.",
    };
  revalidatePath("/", "layout");
  return {
    error: "",
    message:
      v.operation === "accept"
        ? "Agency membership accepted."
        : v.operation === "cancel"
          ? "Invitation cancelled."
          : "Agency membership revoked. Independent access remains separate.",
  };
}
