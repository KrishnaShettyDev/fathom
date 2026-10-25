import { cookies } from "next/headers";
import { z } from "zod";
import {
  credentialKeys,
  encryptCredential,
  exchangeToken,
  keyFor,
  sha256,
  shopSchema,
  transaction,
  verifyCallback,
} from "@fathom/connectors";
import { createSupabaseClient } from "../../../../../lib/supabase/server";
import { shopifyConfiguration } from "../../../../../lib/connectors/config";
const stateSchema = z.object({
  brand_id: z.uuid(),
  source_id: z.uuid(),
  source_version: z.number(),
  actor_id: z.uuid(),
  shop: z.string(),
});
export async function GET(request: Request) {
  const config = shopifyConfiguration();
  if (!config)
    return new Response("Shopify configuration pending", { status: 503 });
  const params = new URL(request.url).searchParams;
  const input = z
    .object({
      state: z.string().min(20).max(200),
      code: z.string().min(1).max(500),
      shop: shopSchema,
    })
    .safeParse(Object.fromEntries(params));
  if (!input.success || !verifyCallback(params, config.clientSecret))
    return new Response("Invalid authorization callback", { status: 400 });
  const client = await createSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return new Response("Sign in again before restarting authorization", {
      status: 401,
    });
  const jar = await cookies();
  const browser = jar.get("fathom-shopify-oauth")?.value;
  jar.set("fathom-shopify-oauth", "", {
    path: "/api/connectors/shopify/callback",
    maxAge: 0,
  });
  if (!browser)
    return new Response("Authorization browser mismatch; restart setup", {
      status: 400,
    });
  try {
    const state = await transaction(async (db) => {
      const result = await db.query(
        "delete from private.oauth_states where state_hash=$1 and browser_hash=$2 and actor_id=$3 and shop=$4 and expires_at>now() returning brand_id,source_id,source_version,actor_id,shop",
        [sha256(input.data.state), sha256(browser), user.id, input.data.shop],
      );
      return stateSchema.parse(result.rows[0]);
    });
    await transaction(async (db) => {
      await db.query("select pg_advisory_xact_lock(hashtextextended($1,7))", [
        state.shop,
      ]);
      const source = await db.query<{ version: number; allowed: boolean }>(
        "select version,private.user_has_brand_access($1,brand_id,$2) allowed from public.brand_sources where id=$3 and brand_id=$4 for update",
        [user.id, "integrations.connect", state.source_id, state.brand_id],
      );
      if (
        !source.rows[0]?.allowed ||
        source.rows[0].version !== state.source_version
      )
        throw new Error("AUTHORITY_CHANGED");
      const existing = await db.query(
        "select id from public.brand_sources where provider=$1 and verified_account=$2 and id<>$3 and state in ($4,$5)",
        ["shopify", state.shop, state.source_id, "authorized", "degraded"],
      );
      if (existing.rowCount) throw new Error("SHOP_ALREADY_ASSIGNED");
      const token = await exchangeToken(state.shop, {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: input.data.code,
        expiring: "1",
      });
      const still = await db.query<{ allowed: boolean }>(
        "select private.user_has_brand_access($1,$2,$3) allowed",
        [user.id, state.brand_id, "integrations.connect"],
      );
      if (!still.rows[0]?.allowed) throw new Error("AUTHORITY_CHANGED");
      const { version } = credentialKeys();
      const encrypted = encryptCredential(
        token,
        keyFor(version),
        `${state.brand_id}:${state.source_id}`,
      );
      await db.query(
        "insert into private.connector_credentials(source_id,brand_id,encrypted_value,key_version,expires_at) values($1,$2,$3,$4,now()+($5 * interval '1 second')) on conflict(source_id) do update set encrypted_value=excluded.encrypted_value,key_version=excluded.key_version,expires_at=excluded.expires_at,updated_at=now()",
        [state.source_id, state.brand_id, encrypted, version, token.expires_in],
      );
      await db.query(
        "update public.collection_runs set state='cancelled',error_code='SOURCE_REAUTHORIZED',completed_at=now() where source_id=$1 and state in ('queued','running')",
        [state.source_id],
      );
      await db.query(
        "update public.brand_sources set state='authorized',verified_account=$1,granted_scopes=$2,error_code=null,version=version+1,updated_at=now(),updated_by=$3 where id=$4",
        [state.shop, token.scope.split(","), user.id, state.source_id],
      );
      await db.query(
        "insert into audit.events(brand_id,actor_id,event_type,details) values($1,$2,'source.authorized',jsonb_build_object('source_id',$3::uuid))",
        [state.brand_id, user.id, state.source_id],
      );
    });
    return Response.redirect(`${config.origin}/connections`, 303);
  } catch {
    return new Response(
      "Authorization could not be completed. Restart setup; verify permissions, shop assignment and provider approval.",
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
