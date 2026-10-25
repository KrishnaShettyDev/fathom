import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import {
  cataloguePage,
  credentialKeys,
  decryptCredential,
  encryptCredential,
  exchangeToken,
  getDatabase,
  keyFor,
  ProviderError,
  tokenSchema,
  transaction,
} from "@fathom/connectors";
const contextSchema = z.object({
  id: z.uuid(),
  brand_id: z.uuid(),
  source_id: z.uuid(),
  verified_account: z.string(),
  phase: z.enum(["products", "variants", "collections", "complete"]),
  cursor: z.string().nullable(),
  pages: z.number(),
  records: z.number(),
});
const credentialSchema = z.object({
  encrypted_value: z.string(),
  key_version: z.string(),
  expires_at: z.date(),
});
async function loadContext(runId: string, signal: AbortSignal) {
  const db = getDatabase();
  const raw = await db.query(
    "select r.id,r.brand_id,r.source_id,r.phase,r.cursor,r.pages,r.records,s.verified_account from public.collection_runs r join public.brand_sources s on s.id=r.source_id where r.id=$1",
    [runId],
  );
  if (!raw.rows[0]) throw new ProviderError("RUN_UNAVAILABLE");
  const context = contextSchema.parse(raw.rows[0]);
  return transaction(async (client) => {
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,7))", [
      context.verified_account,
    ]);
    await client.query(
      "select id from public.brand_sources where id=$1 for update",
      [context.source_id],
    );
    const allowed = await client.query<{ allowed: boolean }>(
      "select private.run_authorized($1) allowed",
      [runId],
    );
    if (!allowed.rows[0]?.allowed) throw new ProviderError("ACCESS_REVOKED");
    const credentials = await client.query(
      "select encrypted_value,key_version,expires_at from private.connector_credentials where source_id=$1 for update",
      [context.source_id],
    );
    const stored = credentialSchema.parse(credentials.rows[0]);
    let token = tokenSchema.parse(
      decryptCredential(
        stored.encrypted_value,
        keyFor(stored.key_version),
        `${context.brand_id}:${context.source_id}`,
      ),
    );
    signal.throwIfAborted();
    if (stored.expires_at.getTime() - Date.now() < 60000) {
      const clientId = process.env.SHOPIFY_CLIENT_ID;
      const clientSecret = process.env.SHOPIFY_CLIENT_SECRET;
      if (!clientId || !clientSecret)
        throw new ProviderError("PROVIDER_NOT_CONFIGURED");
      token = await exchangeToken(
        context.verified_account,
        {
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
          refresh_token: token.refresh_token,
        },
        token.scope,
      );
      signal.throwIfAborted();
      const { version } = credentialKeys();
      const value = encryptCredential(
        token,
        keyFor(version),
        `${context.brand_id}:${context.source_id}`,
      );
      await client.query(
        "update private.connector_credentials set encrypted_value=$1,key_version=$2,expires_at=now()+($3 * interval '1 second'),updated_at=now() where source_id=$4",
        [value, version, token.expires_in, context.source_id],
      );
    }
    await client.query(
      "update public.collection_runs set state='running',error_code=null where id=$1",
      [runId],
    );
    return { ...context, token: token.access_token };
  });
}
export async function runCatalogue(
  runId: string,
  signal: AbortSignal,
): Promise<void> {
  for (;;) {
    signal.throwIfAborted();
    const context = await loadContext(runId, signal);
    if (context.phase === "complete") return;
    if (context.pages >= 1000)
      throw new ProviderError("PAGE_ALLOWANCE_REACHED");
    const page = await cataloguePage(
      context.verified_account,
      context.token,
      context.phase,
      context.cursor,
    );
    signal.throwIfAborted();
    const kind =
      context.phase === "products"
        ? "product"
        : context.phase === "variants"
          ? "variant"
          : "collection";
    const nextPhase = page.pageInfo.hasNextPage
      ? context.phase
      : context.phase === "products"
        ? "variants"
        : context.phase === "variants"
          ? "collections"
          : "complete";
    await transaction(async (db) => {
      await db.query(
        "select id from public.brand_sources where id=$1 for update",
        [context.source_id],
      );
      const locked = await db.query<{ phase: string; cursor: string | null }>(
        "select phase,cursor from public.collection_runs where id=$1 for update",
        [runId],
      );
      const authorized = await db.query<{ allowed: boolean }>(
        "select private.run_authorized($1) allowed",
        [runId],
      );
      if (!authorized.rows[0]?.allowed)
        throw new ProviderError("ACCESS_REVOKED");
      if (
        locked.rows[0]?.phase !== context.phase ||
        locked.rows[0].cursor !== context.cursor
      )
        throw new ProviderError("CHECKPOINT_CHANGED");
      signal.throwIfAborted();
      for (const node of page.nodes)
        await db.query(
          "insert into public.catalogue_records(brand_id,source_id,external_id,kind,title,payload,seen_run_id) values($1,$2,$3,$4,$5,$6,$7) on conflict(source_id,kind,external_id) do update set title=excluded.title,payload=excluded.payload,seen_run_id=excluded.seen_run_id,observed_at=now(),removed_at=null",
          [
            context.brand_id,
            context.source_id,
            node.id,
            kind,
            node.title,
            JSON.stringify({ ...node, currency: page.currency }),
            runId,
          ],
        );
      await db.query(
        "update public.collection_runs set phase=$1,cursor=$2,pages=pages+1,records=records+$3 where id=$4",
        [
          nextPhase,
          page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null,
          page.nodes.length,
          runId,
        ],
      );
      if (nextPhase === "complete") {
        await db.query(
          "update public.catalogue_records set removed_at=now() where source_id=$1 and seen_run_id<>$2 and removed_at is null",
          [context.source_id, runId],
        );
        await db.query(
          "update public.collection_runs set state='complete',completed_at=now(),error_code=null where id=$1",
          [runId],
        );
        await db.query(
          "update public.brand_sources set last_success_at=now(),error_code=null,reconciliation_requested_at=case when reconciliation_requested_at<=(select created_at from public.collection_runs where id=$2) then null else reconciliation_requested_at end where id=$1",
          [context.source_id, runId],
        );
      }
    });
    if (nextPhase === "complete") return;
    await delay(500, undefined, { signal });
  }
}
export async function recordRunError(
  runId: string,
  error: unknown,
  finalAttempt: boolean,
) {
  const code =
    error instanceof ProviderError ? error.code : "COLLECTION_FAILED";
  const revoked = code === "ACCESS_REVOKED";
  const terminal =
    finalAttempt ||
    revoked ||
    [
      "AUTHORIZATION_EXPIRED",
      "MISSING_PRODUCT_SCOPE",
      "PAGE_ALLOWANCE_REACHED",
      "PROVIDER_NOT_CONFIGURED",
    ].includes(code);
  await transaction(async (db) => {
    const row = await db.query<{ source_id: string }>(
      "select source_id from public.collection_runs where id=$1",
      [runId],
    );
    if (!row.rows[0]) return;
    await db.query(
      "select id from public.brand_sources where id=$1 for update",
      [row.rows[0].source_id],
    );
    await db.query(
      "update public.collection_runs set error_code=$2,state=case when $3 then case when $4 then 'cancelled' when records>0 then 'partial' else 'failed' end else state end,completed_at=case when $3 then now() else completed_at end where id=$1 and state in ('queued','running')",
      [runId, code, terminal, revoked],
    );
    if (code === "AUTHORIZATION_EXPIRED" || code === "MISSING_PRODUCT_SCOPE")
      await db.query(
        "update public.brand_sources set state='degraded',error_code=$2 where id=$1 and state='authorized'",
        [row.rows[0].source_id, code],
      );
  });
  return { code, terminal };
}
