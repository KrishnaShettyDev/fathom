import { createHash, randomUUID } from "node:crypto";
import type { DatabasePool } from "@fathom/connectors";
const tables = [
  ["public.brand_workspaces", "id"],
  ["public.brand_memberships", "brand_id"],
  ["public.brand_invitations", "brand_id"],
  ["public.brand_access_grants", "brand_id"],
  ["public.support_sessions", "brand_id"],
  ["public.brand_sources", "brand_id"],
  ["public.collection_allowances", "brand_id"],
  ["public.collection_runs", "brand_id"],
  ["public.catalogue_records", "brand_id"],
  ["public.analytics_days", "brand_id"],
  ["public.brand_facts", "brand_id"],
  ["public.brand_fact_revisions", "brand_id"],
  ["public.observation_cohorts", "brand_id"],
  ["public.research_runs", "brand_id"],
  ["public.observation_samples", "brand_id"],
  ["public.audit_checks", "brand_id"],
  ["public.audit_findings", "brand_id"],
  ["public.opportunities", "brand_id"],
  ["public.opportunity_events", "brand_id"],
  ["public.client_reports", "brand_id"],
  ["public.baseline_reviews", "brand_id"],
  ["public.brand_claim_requests", "accepted_brand_id"],
  ["audit.events", "brand_id"],
] as const;
export class ExportAccessError extends Error {}
async function authorize(
  database: DatabasePool,
  actorId: string,
  brandId: string,
  signal: AbortSignal,
) {
  signal.throwIfAborted();
  const result = await database.query<{ allowed: boolean }>(
    "select private.user_has_brand_access($1,$2,'workspace.manage') allowed",
    [actorId, brandId],
  );
  if (!result.rows[0]?.allowed)
    throw new ExportAccessError("Brand export unavailable");
}
export async function brandExport(
  database: DatabasePool,
  actorId: string,
  brandId: string,
  requestSignal: AbortSignal,
) {
  const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(120_000)]);
  await authorize(database, actorId, brandId, signal);
  const exportId = randomUUID();
  await database.query(
    "insert into audit.events(brand_id,actor_id,event_type,details) values($1,$2,'workspace.export_started',$3)",
    [brandId, actorId, JSON.stringify({ export_id: exportId })],
  );
  async function* lines() {
    const db = await database.connect();
    let transactionOpen = false;
    let connectionFailed = false;
    const onConnectionError = () => {
      connectionFailed = true;
    };
    db.on("error", onConnectionError);
    const hash = createHash("sha256");
    let records = 0;
    try {
      await db.query("begin isolation level repeatable read read only");
      transactionOpen = true;
      await db.query("set local statement_timeout='30s'");
      await db.query("set local idle_in_transaction_session_timeout='60s'");
      const snapshot = await db.query<{ captured_at: Date }>(
        "select now() captured_at",
      );
      const manifest =
        JSON.stringify({
          type: "manifest",
          schema_version: 1,
          export_id: exportId,
          brand_id: brandId,
          captured_at: snapshot.rows[0]?.captured_at,
          format: "NDJSON",
          completion_required: true,
        }) + "\n";
      hash.update(manifest);
      yield manifest;
      for (const [table, column] of tables) {
        await authorize(database, actorId, brandId, signal);
        // Both identifiers come exclusively from the fixed allowlist above.
        await db.query(
          `declare export_rows no scroll cursor for select to_jsonb(row) record from ${table} row where ${column}=$1`,
          [brandId],
        );
        while (true) {
          await authorize(database, actorId, brandId, signal);
          const batch = await db.query<{ record: unknown }>(
            "fetch forward 25 from export_rows",
          );
          await authorize(database, actorId, brandId, signal);
          if (!batch.rows.length) break;
          const chunk = batch.rows
            .map(
              (row) =>
                JSON.stringify({ type: "record", table, record: row.record }) +
                "\n",
            )
            .join("");
          records += batch.rows.length;
          hash.update(chunk);
          yield chunk;
        }
        await db.query("close export_rows");
      }
      await authorize(database, actorId, brandId, signal);
      await db.query("commit");
      transactionOpen = false;
      await database.query(
        "insert into audit.events(brand_id,actor_id,event_type,details) values($1,$2,'workspace.export_completed',$3)",
        [brandId, actorId, JSON.stringify({ export_id: exportId, records })],
      );
      yield JSON.stringify({
        type: "complete",
        export_id: exportId,
        records,
        sha256: hash.digest("hex"),
      }) + "\n";
    } finally {
      try {
        if (transactionOpen && !connectionFailed) await db.query("rollback");
      } finally {
        db.removeListener("error", onConnectionError);
        db.release(connectionFailed);
      }
    }
  }
  const iterator = lines();
  const encoder = new TextEncoder();
  let finished = false;
  let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
  const interrupted = () =>
    new Error(
      "Export interrupted. Download again after checking access and server availability.",
    );
  const onAbort = () => {
    if (finished) return;
    finished = true;
    streamController?.error(interrupted());
    void iterator
      .return(undefined)
      .catch(() =>
        console.error(JSON.stringify({ event: "export.cleanup_failed" })),
      );
  };
  return new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) onAbort();
    },
    async pull(controller) {
      if (finished) return;
      try {
        const next = await iterator.next();
        if (finished) return;
        if (next.done) {
          finished = true;
          signal.removeEventListener("abort", onAbort);
          controller.close();
        } else controller.enqueue(encoder.encode(next.value));
      } catch {
        finished = true;
        signal.removeEventListener("abort", onAbort);
        controller.error(interrupted());
      }
    },
    async cancel() {
      finished = true;
      signal.removeEventListener("abort", onAbort);
      await iterator.return(undefined);
    },
  });
}
