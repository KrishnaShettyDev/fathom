import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSupabaseConfig } from "./config";
import type { Database } from "./database.types";

export async function createSupabaseClient(writableCookies = false) {
  const config = getSupabaseConfig();
  if (!config) redirect("/setup");
  const cookieStore = await cookies();
  return createServerClient<Database>(config.url, config.key, {
    cookieOptions: {
      sameSite: "lax",
      httpOnly: true,
      path: "/",
      secure: process.env.NODE_ENV === "production",
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        // Server components cannot set response cookies. The proxy has already
        // refreshed them; mutations explicitly opt into a writable cookie store.
        if (writableCookies)
          for (const { name, value, options } of values)
            cookieStore.set(name, value, options);
      },
    },
  });
}
