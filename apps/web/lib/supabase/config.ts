import "server-only";
import { z } from "zod";

export function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const parsed = z.url().safeParse(url);
  if (!parsed.success)
    throw new Error("Supabase URL configuration is invalid.");
  if (key.startsWith("sb_secret_"))
    throw new Error("Use a Supabase publishable key, never a secret key.");
  if (key.startsWith("eyJ")) {
    const payload = key.split(".")[1];
    if (!payload) throw new Error("Invalid Supabase key configuration.");
    const claims: unknown = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    );
    if (!z.object({ role: z.literal("anon") }).safeParse(claims).success)
      throw new Error(
        "Only an anon or publishable key may be used by the app.",
      );
  } else if (!key.startsWith("sb_publishable_")) {
    throw new Error("Invalid Supabase publishable key configuration.");
  }
  return { url: parsed.data, key };
}
