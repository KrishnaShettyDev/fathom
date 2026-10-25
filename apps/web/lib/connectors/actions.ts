"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { nonce, sha256, shopSchema, transaction } from "@fathom/connectors";
import { requireUser } from "../auth/session";
import { shopifyConfiguration } from "./config";
import type { SourceFormState } from "../sources/validation";
const sourceInput = z.object({ brandId: z.uuid(), sourceId: z.uuid() });
export async function authorizeShopify(
  _state: SourceFormState,
  form: FormData,
): Promise<SourceFormState> {
  const input = sourceInput.safeParse(Object.fromEntries(form));
  if (!input.success || form.get("confirm") !== "on")
    return { error: "Confirm the brand and Shopify shop before authorizing." };
  const config = shopifyConfiguration();
  if (!config)
    return {
      error:
        "Shopify server configuration is pending. No authorization request was made.",
    };
  const { client, user } = await requireUser();
  const { data: source, error } = await client
    .from("brand_sources")
    .select("*")
    .eq("brand_id", input.data.brandId)
    .eq("id", input.data.sourceId)
    .maybeSingle();
  if (error || !source || source.provider !== "shopify")
    return { error: "Shopify source unavailable." };
  const shop = shopSchema.safeParse(source.account_reference);
  if (!shop.success)
    return {
      error:
        "Save the exact myshopify.com shop domain without a URL path or protocol.",
    };
  const state = nonce();
  const browser = nonce();
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
        "insert into private.oauth_states(state_hash,browser_hash,brand_id,source_id,source_version,actor_id,shop) values($1,$2,$3,$4,$5,$6,$7)",
        [
          sha256(state),
          sha256(browser),
          source.brand_id,
          source.id,
          source.version,
          user.id,
          shop.data,
        ],
      );
    });
  } catch {
    return {
      error:
        "Authorization could not start. Check current permissions and server configuration.",
    };
  }
  (await cookies()).set("fathom-shopify-oauth", browser, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/connectors/shopify/callback",
    maxAge: 600,
  });
  const params = new URLSearchParams({
    client_id: config.clientId,
    scope: "read_products",
    redirect_uri: config.redirectUri,
    state,
  });
  redirect(`https://${shop.data}/admin/oauth/authorize?${params}`);
}
export async function syncSource(
  _state: SourceFormState,
  form: FormData,
): Promise<SourceFormState> {
  const parsed = sourceInput
    .extend({ requestId: z.uuid() })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Invalid source selection." };
  const { client } = await requireUser();
  const { error } = await client.rpc("request_source_sync", {
    target_brand: parsed.data.brandId,
    source: parsed.data.sourceId,
    sync_request_id: parsed.data.requestId,
  });
  if (error)
    return {
      error:
        error.code === "54000"
          ? "Monthly collection allowance exhausted. Existing data remains available."
          : "Sync could not be queued. Check authorization and current source state.",
    };
  revalidatePath("/connections");
  return {
    error: "",
    message:
      "Sync request saved durably. Processing starts when the worker is configured and running.",
  };
}
export async function setAllowance(
  _state: SourceFormState,
  form: FormData,
): Promise<SourceFormState> {
  const parsed = z
    .object({
      brandId: z.uuid(),
      limit: z.coerce.number().int().min(0).max(1000),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "Choose a monthly run limit from 0 to 1000." };
  const { client } = await requireUser();
  const { error } = await client.rpc("set_collection_allowance", {
    target_brand: parsed.data.brandId,
    run_limit: parsed.data.limit,
  });
  if (error)
    return { error: "Only a current brand manager can change the allowance." };
  revalidatePath("/connections");
  return {
    error: "",
    message:
      "Collection allowance saved. This is a run limit, not a billing subscription.",
  };
}
