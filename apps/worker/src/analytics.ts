import { z } from "zod";
import {
  collectDaily,
  credentialKeys,
  decryptCredential,
  encryptCredential,
  getDatabase,
  googleToken,
  googleTokenSchema,
  keyFor,
  ProviderError,
  transaction,
} from "@fathom/connectors";
const contextSchema = z.object({
  brand_id: z.uuid(),
  source_id: z.uuid(),
  provider: z.enum(["gsc", "ga4"]),
  verified_account: z.string(),
  provider_timezone: z.string(),
  range_start: z.string(),
  range_end: z.string(),
});
export async function runAnalytics(runId: string, signal: AbortSignal) {
  const raw = await getDatabase().query(
    "select r.brand_id,r.source_id,r.range_start::text,r.range_end::text,s.provider,s.verified_account,s.provider_timezone from public.collection_runs r join public.brand_sources s on s.id=r.source_id where r.id=$1",
    [runId],
  );
  const context = contextSchema.parse(raw.rows[0]);
  const token = await transaction(async (db) => {
    await db.query(
      "select id from public.brand_sources where id=$1 for update",
      [context.source_id],
    );
    const auth = await db.query<{ allowed: boolean }>(
      "select private.run_authorized($1) allowed",
      [runId],
    );
    if (!auth.rows[0]?.allowed) throw new ProviderError("ACCESS_REVOKED");
    const result = await db.query(
      "select encrypted_value,key_version,expires_at from private.connector_credentials where source_id=$1 for update",
      [context.source_id],
    );
    const stored = z
      .object({
        encrypted_value: z.string(),
        key_version: z.string(),
        expires_at: z.date(),
      })
      .parse(result.rows[0]);
    let value = googleTokenSchema.parse(
      decryptCredential(
        stored.encrypted_value,
        keyFor(stored.key_version),
        `${context.brand_id}:${context.source_id}`,
      ),
    );
    signal.throwIfAborted();
    if (stored.expires_at.getTime() - Date.now() < 60000) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientId || !clientSecret)
        throw new ProviderError("PROVIDER_NOT_CONFIGURED");
      value = await googleToken(
        {
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "refresh_token",
          refresh_token: value.refresh_token,
        },
        value,
      );
      signal.throwIfAborted();
      const { version } = credentialKeys();
      await db.query(
        "update private.connector_credentials set encrypted_value=$1,key_version=$2,expires_at=now()+($3 * interval '1 second'),updated_at=now() where source_id=$4",
        [
          encryptCredential(
            value,
            keyFor(version),
            `${context.brand_id}:${context.source_id}`,
          ),
          version,
          value.expires_in,
          context.source_id,
        ],
      );
    }
    await db.query(
      "update public.collection_runs set state='running',error_code=null where id=$1",
      [runId],
    );
    return value.access_token;
  });
  const rows = await collectDaily(
    context.provider,
    context.verified_account,
    token,
    context.range_start,
    context.range_end,
  );
  signal.throwIfAborted();
  await transaction(async (db) => {
    await db.query(
      "select id from public.brand_sources where id=$1 for update",
      [context.source_id],
    );
    await db.query(
      "select id from public.collection_runs where id=$1 for update",
      [runId],
    );
    const auth = await db.query<{ allowed: boolean }>(
      "select private.run_authorized($1) allowed",
      [runId],
    );
    if (!auth.rows[0]?.allowed) throw new ProviderError("ACCESS_REVOKED");
    signal.throwIfAborted();
    for (const row of rows)
      await db.query(
        "insert into public.analytics_days(brand_id,source_id,observed_date,provider,provider_timezone,state,metrics,metadata,run_id) values($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict(source_id,observed_date) do update set provider_timezone=excluded.provider_timezone,state=excluded.state,metrics=excluded.metrics,metadata=excluded.metadata,run_id=excluded.run_id,captured_at=now()",
        [
          context.brand_id,
          context.source_id,
          row.date,
          context.provider,
          context.provider_timezone,
          row.metrics === null ? "unavailable" : "available",
          row.metrics === null ? null : JSON.stringify(row.metrics),
          JSON.stringify(row.metadata),
          runId,
        ],
      );
    await db.query(
      "update public.collection_runs set state='complete',phase='complete',pages=1,records=$2,error_code=null,completed_at=now() where id=$1",
      [runId, rows.length],
    );
    await db.query(
      "update public.brand_sources set last_success_at=now(),error_code=null where id=$1",
      [context.source_id],
    );
  });
}
