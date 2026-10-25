import { cookies } from "next/headers";
import { z } from "zod";
import {
  credentialKeys,
  decryptCredential,
  encryptCredential,
  googleScopes,
  googleToken,
  keyFor,
  sha256,
  transaction,
  verifyGoogleProperty,
} from "@fathom/connectors";
import { createSupabaseClient } from "../../../../../lib/supabase/server";
import { googleConfiguration } from "../../../../../lib/connectors/config";
const stateSchema = z.object({
  brand_id: z.uuid(),
  source_id: z.uuid(),
  source_version: z.number(),
  provider: z.enum(["gsc", "ga4"]),
  shop: z.string(),
  encrypted_verifier: z.string(),
  key_version: z.string(),
});
export async function GET(request: Request) {
  const config = googleConfiguration();
  if (!config)
    return new Response("Google configuration pending", { status: 503 });
  const params = new URL(request.url).searchParams;
  const input = z
    .object({
      state: z.string().min(20).max(200),
      code: z.string().min(1).max(2000),
    })
    .safeParse(Object.fromEntries(params));
  if (
    !input.success ||
    [...new Set(params.keys())].some((k) => params.getAll(k).length !== 1)
  )
    return new Response("Invalid authorization callback", { status: 400 });
  const client = await createSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user)
    return new Response("Sign in again and restart authorization", {
      status: 401,
    });
  const jar = await cookies();
  const browser = jar.get("fathom-google-oauth")?.value;
  jar.set("fathom-google-oauth", "", {
    path: "/api/connectors/google/callback",
    maxAge: 0,
  });
  if (!browser)
    return new Response("Browser mismatch; restart setup", { status: 400 });
  try {
    const hash = sha256(input.data.state);
    const state = await transaction(async (db) => {
      const raw = await db.query(
        "delete from private.oauth_states where state_hash=$1 and browser_hash=$2 and actor_id=$3 and provider in ('gsc','ga4') and expires_at>now() returning brand_id,source_id,source_version,provider,shop,encrypted_verifier,key_version",
        [hash, sha256(browser), user.id],
      );
      return stateSchema.parse(raw.rows[0]);
    });
    const { verifier } = z
      .object({ verifier: z.string() })
      .parse(
        decryptCredential(
          state.encrypted_verifier,
          keyFor(state.key_version),
          hash,
        ),
      );
    await transaction(async (db) => {
      const source = await db.query<{ version: number; allowed: boolean }>(
        "select version,private.user_has_brand_access($1,brand_id,$2) allowed from public.brand_sources where id=$3 and brand_id=$4 for update",
        [user.id, "integrations.connect", state.source_id, state.brand_id],
      );
      if (
        !source.rows[0]?.allowed ||
        source.rows[0].version !== state.source_version
      )
        throw new Error("AUTHORITY_CHANGED");
      const token = await googleToken({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: input.data.code,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
        code_verifier: verifier,
      });
      if (!token.scope.split(" ").includes(googleScopes[state.provider]))
        throw new Error("REQUIRED_SCOPE_MISSING");
      const property = await verifyGoogleProperty(
        state.provider,
        state.shop,
        token.access_token,
      );
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
        "update public.brand_sources set state='authorized',verified_account=$1,provider_timezone=$2,provider_metadata=$3,granted_scopes=$4,error_code=null,version=version+1,updated_at=now(),updated_by=$5 where id=$6",
        [
          property.reference,
          property.timezone,
          JSON.stringify(property.metadata),
          token.scope.split(" "),
          user.id,
          state.source_id,
        ],
      );
      await db.query(
        "insert into audit.events(brand_id,actor_id,event_type,details) values($1,$2,'source.authorized',jsonb_build_object('source_id',$3::uuid))",
        [state.brand_id, user.id, state.source_id],
      );
    });
    return Response.redirect(`${config.origin}/connections`, 303);
  } catch {
    return new Response(
      "Authorization failed. Restart setup and verify the exact property, granted scope and current brand permissions.",
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
}
