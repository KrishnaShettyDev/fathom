import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseClient } from "../supabase/server";

export const requireUser = cache(async () => {
  const client = await createSupabaseClient();
  const { data, error } = await client.auth.getUser();
  if (error && error.status && error.status >= 500)
    throw new Error("Sign-in service is unavailable. Please try again.");
  if (!data.user) redirect("/login");
  return { client, user: data.user };
});
