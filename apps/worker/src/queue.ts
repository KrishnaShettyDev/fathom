import { reconcileStoppedJobs } from "./recovery.js";
import { runResearch, failResearch } from "./research.js";
import { runAnalytics } from "./analytics.js";
import { PgBoss } from "pg-boss";
import { z } from "zod";
import { closeDatabase, getDatabase, ProviderError } from "@fathom/connectors";
import { setTimeout as delay } from "node:timers/promises";
import { runCatalogue, recordRunError } from "./catalogue.js";
const queueName = "catalogue-v1";
const jobSchema = z.object({
  schemaVersion: z.literal(1),
  runId: z.uuid(),
  kind: z
    .enum(["shopify_catalogue", "gsc_daily", "ga4_daily"])
    .default("shopify_catalogue"),
});
export async function startQueues() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) return null;
  const boss = new PgBoss({ connectionString, max: 4 });
  const stop = new AbortController();
  let dispatching = false;
  let dispatchTask: Promise<void> | null = null;
  let lastRecovery = 0;
  boss.on("error", () =>
    console.error(JSON.stringify({ event: "queue.error" })),
  );
  await boss.start();
  await boss.createQueue(queueName, {
    retryLimit: 5,
    retryDelay: 10,
    retryBackoff: true,
    expireInSeconds: 1800,
  });
  await boss.work(
    queueName,
    { includeMetadata: true, localConcurrency: 2, groupConcurrency: 1 },
    async (jobs) => {
      for (const job of jobs) {
        const data = jobSchema.parse(job.data);
        const signal = AbortSignal.any([
          job.signal,
          stop.signal,
          AbortSignal.timeout(25 * 60 * 1000),
        ]);
        try {
          if (data.kind === "shopify_catalogue")
            await runCatalogue(data.runId, signal);
          else await runAnalytics(data.runId, signal);
        } catch (error) {
          const result = await recordRunError(
            data.runId,
            error,
            job.retryCount >= job.retryLimit,
          );
          if (result && !result.terminal) {
            if (error instanceof ProviderError && error.retryAfterSeconds)
              await delay(error.retryAfterSeconds * 1000, undefined, {
                signal,
              });
            throw new Error(result.code);
          }
        }
      }
    },
  );
  await boss.createQueue("research-v1", {
    retryLimit: 0,
    expireInSeconds: 1800,
  });
  await boss.work("research-v1", { localConcurrency: 1 }, async (jobs) => {
    for (const job of jobs) {
      const data = z.object({ runId: z.uuid() }).parse(job.data);
      try {
        await runResearch(
          data.runId,
          AbortSignal.any([
            job.signal,
            stop.signal,
            AbortSignal.timeout(25 * 60 * 1000),
          ]),
        );
      } catch (error) {
        await failResearch(data.runId, error);
      }
    }
  });
  async function dispatch() {
    if (dispatching || stop.signal.aborted) return;
    dispatching = true;
    try {
      const db = getDatabase();
      if (Date.now() - lastRecovery > 60_000) {
        await reconcileStoppedJobs(boss);
        lastRecovery = Date.now();
      }
      await db.query("select private.schedule_reconciliation()");
      if (process.env.OPENAI_API_KEY && process.env.OBSERVATION_MODEL)
        await db.query("select private.schedule_observations()");
      const research = await db.query<{ run_id: string }>(
        "select o.run_id from private.research_outbox o join public.research_runs r on r.id=o.run_id where o.dispatched_at is null and r.state='scheduled' order by o.created_at limit 10",
      );
      for (const row of research.rows) {
        await boss.send(
          "research-v1",
          { runId: row.run_id },
          { id: row.run_id },
        );
        await db.query(
          "update private.research_outbox set dispatched_at=now() where run_id=$1",
          [row.run_id],
        );
      }

      const result = await db.query<{
        run_id: string;
        source_id: string;
        kind: string;
      }>(
        "select o.run_id,r.source_id,r.kind from private.job_outbox o join public.collection_runs r on r.id=o.run_id where o.dispatched_at is null and r.state='queued' order by o.created_at limit 20",
      );
      for (const row of result.rows) {
        await boss.send(
          queueName,
          { schemaVersion: 1, runId: row.run_id, kind: row.kind },
          { id: row.run_id, group: { id: row.source_id } },
        );
        await db.query(
          "update private.job_outbox set dispatched_at=now() where run_id=$1",
          [row.run_id],
        );
      }
    } catch {
      console.error(JSON.stringify({ event: "outbox.dispatch_failed" }));
    } finally {
      dispatching = false;
    }
  }
  function dispatchOnce() {
    dispatchTask ??= dispatch().finally(() => {
      dispatchTask = null;
    });
    return dispatchTask;
  }
  const timer = setInterval(() => void dispatchOnce(), 2000);
  timer.unref();
  await dispatchOnce();
  return {
    async stop() {
      clearInterval(timer);
      stop.abort();
      await dispatchTask;
      await boss.stop({ graceful: true, timeout: 8000 });
      await closeDatabase();
    },
  };
}
