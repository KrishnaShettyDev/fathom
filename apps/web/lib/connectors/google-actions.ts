"use server";
import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  credentialKeys,
  encryptCredential,
  googleScopes,
  keyFor,
  nonce,
  propertyReference,
  sha256,
  transaction,
} from "@fathom/connectors";
import { requireUser } from "../auth/session";
import { googleConfiguration } from "./config";
import type { SourceFormState } from "../sources/validation";
export async function authorizeGoogle(
  _state: SourceFormState,
  form: FormData,
): Promise<SourceFormState> {
  const parsed = z
    .object({ brandId: z.uuid(), sourceId: z.uuid(), confirm: z.literal("on") })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "Confirm the exact brand and property." };
  const config = googleConfiguration();
  if (!config) return { error: "Google server configuration is pending." };
  const { client, user } = await requireUser();
  const { data: source, error } = await client
    .from("brand_sources")
    .select("*")
    .eq("brand_id", parsed.data.brandId)
    .eq("id", parsed.data.sourceId)
    .maybeSingle();
  if (
    error ||
    !source ||
    (source.provider !== "gsc" && source.provider !== "ga4")
  )
    return { error: "Google property source unavailable." };
  let reference: string;
  try {
    reference = propertyReference(source.provider, source.account_reference);
  } catch {
    return {
      error:
        "Use the exact Search Console URL/sc-domain property, or properties/123456 for GA4.",
    };
  }
  const state = nonce();
  const browser = nonce();
  const verifier = nonce();
  const { version } = credentialKeys();
  try {
    await transaction(async (db) => {
      const check = await db.query<{ allowed: boolean }>(
        "select private.user_has_brand_access($1,$2,$3) allowed",
        [user.id, source.brand_id, "integrations.connect"],
      );
      if (!check.rows[0]?.allowed) throw new Error("NOT_AUTHORIZED");
      await db.query(
        "delete from private.oauth_states where expires_at<=now() or (actor_id=$1 and source_id=$2)",
        [user.id, source.id],
      );
      await db.query(
        "insert into private.oauth_states(state_hash,browser_hash,brand_id,source_id,source_version,actor_id,shop,provider,encrypted_verifier,key_version) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
        [
          sha256(state),
          sha256(browser),
          source.brand_id,
          source.id,
          source.version,
          user.id,
          reference,
          source.provider,
          encryptCredential({ verifier }, keyFor(version), sha256(state)),
          version,
        ],
      );
    });
  } catch {
    return {
      error:
        "Authorization could not start. Check current permissions and configuration.",
    };
  }
  (await cookies()).set("fathom-google-oauth", browser, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/connectors/google/callback",
    maxAge: 600,
  });
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: googleScopes[source.provider],
    access_type: "offline",
    prompt: "consent",
    state,
    code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256",
  });
  redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
