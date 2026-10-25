"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createSupabaseClient } from "../supabase/server";
import { emailSchema, otpSchema, type FormState } from "./validation";

export async function requestCode(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const email = emailSchema.safeParse(form.get("email"));
  if (!email.success) return { error: "Enter a valid email address." };
  const client = await createSupabaseClient(true);
  const { error } = await client.auth.signInWithOtp({
    email: email.data,
    options: { shouldCreateUser: true },
  });
  if (error)
    return {
      error: "We couldn’t request a code. Wait a minute and try again.",
    };
  return { error: "", email: email.data, sentAt: Date.now() };
}
export async function verifyCode(
  _previous: FormState,
  form: FormData,
): Promise<FormState> {
  const email = emailSchema.safeParse(form.get("email"));
  const code = otpSchema.safeParse(form.get("code"));
  if (!email.success || !code.success)
    return { error: "Enter your email and six-digit code." };
  const client = await createSupabaseClient(true);
  const { error } = await client.auth.verifyOtp({
    email: email.data,
    token: code.data,
    type: "email",
  });
  if (error)
    return {
      error:
        "The code could not be verified. Check it or request a new one after a minute.",
    };
  redirect("/");
}
export async function signOut() {
  const client = await createSupabaseClient(true);
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw new Error("Unable to sign out. Please try again.");
  (await cookies()).delete("fathom-brand");
  redirect("/login");
}
