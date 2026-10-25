import { getDatabase, ProviderError } from "@fathom/connectors";
import type { PgBoss } from "pg-boss";
import { recordRunError } from "./catalogue.js";
import { failResearch } from "./research.js";
/** Reconcile durable application state with terminal queue jobs after worker death. */
export async function reconcileStoppedJobs(boss: PgBoss) {
  const result = await getDatabase().query<{
    id: string;
    kind: "collection" | "research";
  }>(
    `select r.id,'collection' kind from public.collection_runs r
     join private.job_outbox o on o.run_id=r.id
     where r.state in ('queued','running') and o.dispatched_at < now()-interval '1 minute'
     union all
     select r.id,'research' kind from public.research_runs r
     join private.research_outbox o on o.run_id=r.id
     where r.state in ('scheduled','collecting') and o.dispatched_at < now()-interval '1 minute'
     limit 100`,
  );
  for (const run of result.rows) {
    const job = await boss.getJobById(
      run.kind === "collection" ? "catalogue-v1" : "research-v1",
      run.id,
    );
    if (job && !["failed", "cancelled", "completed"].includes(job.state))
      continue;
    // Missing jobs have passed queue retention or were removed; never silently replay
    // potentially billable observations. Existing evidence remains inspectable.
    const error = new ProviderError("WORKER_INTERRUPTED");
    if (run.kind === "collection") await recordRunError(run.id, error, true);
    else await failResearch(run.id, error);
  }
}
