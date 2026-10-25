import { setTimeout as delay } from "node:timers/promises";
import { z } from "zod";
import {
  fetchPublicPage,
  getDatabase,
  inspectHtml,
  observeQuestion,
  ProviderError,
  robotsPolicy,
  subjectMentions,
  transaction,
} from "@fathom/connectors";
const runSchema = z.object({
  id: z.uuid(),
  brand_id: z.uuid(),
  kind: z.enum(["audit", "observation"]),
  target_url: z.string().nullable(),
  snapshot: z.unknown(),
});
const cohortSchema = z.object({
  questions: z.array(z.string()),
  subjects: z.array(z.string()),
  samples: z.number().int(),
  model: z.string(),
  market: z.string(),
  language: z.string(),
});
async function authorize(runId: string, signal: AbortSignal) {
  signal.throwIfAborted();
  const result = await getDatabase().query<{ allowed: boolean }>(
    "select private.research_authorized($1) allowed",
    [runId],
  );
  if (!result.rows[0]?.allowed) throw new ProviderError("ACCESS_REVOKED");
}
export async function runResearch(runId: string, signal: AbortSignal) {
  const db = getDatabase();
  await authorize(runId, signal);
  const result = await db.query(
    "select id,brand_id,kind,target_url,snapshot from public.research_runs where id=$1",
    [runId],
  );
  const run = runSchema.parse(result.rows[0]);
  await db.query(
    "update public.research_runs set state='collecting',error_code=null where id=$1 and state='scheduled'",
    [runId],
  );
  if (run.kind === "observation") {
    const cohort = cohortSchema.parse(run.snapshot);
    if (
      !process.env.OPENAI_API_KEY ||
      cohort.model !== process.env.OBSERVATION_MODEL
    )
      throw new ProviderError("OBSERVATION_NOT_CONFIGURED");
    for (
      let ordinal = 0;
      ordinal < cohort.questions.length * cohort.samples;
      ordinal++
    ) {
      const question = cohort.questions[Math.floor(ordinal / cohort.samples)];
      if (!question) throw new ProviderError("INVALID_QUESTION");
      await authorize(runId, signal);
      const completed = await db.query(
        "select id from public.observation_samples where run_id=$1 and ordinal=$2",
        [runId, ordinal],
      );
      if (completed.rowCount) continue;
      const claim = await db.query(
        "insert into private.observation_attempts(run_id,ordinal) values($1,$2) on conflict do nothing returning ordinal",
        [runId, ordinal],
      );
      let state: "complete" | "failed" | "unknown" = claim.rowCount
        ? "failed"
        : "unknown";
      let answer: string | null = null;
      let actualModel: string | null = null;
      let responseId: string | null = null;
      let usage: unknown = null;
      let errorCode: string | null = claim.rowCount
        ? null
        : "PREVIOUS_ATTEMPT_OUTCOME_UNKNOWN";
      let mentions: Record<string, boolean> = {};
      if (claim.rowCount)
        try {
          const observation = await observeQuestion(
            question,
            cohort.model,
            cohort.market,
            cohort.language,
            signal,
          );
          answer = observation.answer;
          actualModel = observation.model;
          responseId = observation.responseId;
          usage = observation.usage;
          mentions = subjectMentions(answer, cohort.subjects);
          state = "complete";
        } catch (error) {
          if (signal.aborted) throw error;
          state = error instanceof ProviderError ? "failed" : "unknown";
          errorCode =
            error instanceof ProviderError
              ? error.code
              : "OBSERVATION_REQUEST_FAILED";
        }
      await transaction(async (client) => {
        await client.query(
          "select id from public.research_runs where id=$1 for update",
          [runId],
        );
        const allowed = await client.query<{ allowed: boolean }>(
          "select private.research_authorized($1) allowed",
          [runId],
        );
        if (!allowed.rows[0]?.allowed)
          throw new ProviderError("ACCESS_REVOKED");
        signal.throwIfAborted();
        await client.query(
          "insert into public.observation_samples(brand_id,run_id,ordinal,question,state,answer,mentions,actual_model,provider_response_id,usage,error_code) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict do nothing",
          [
            run.brand_id,
            runId,
            ordinal,
            question,
            state,
            answer,
            JSON.stringify(mentions),
            actualModel,
            responseId,
            usage === null ? null : JSON.stringify(usage),
            errorCode,
          ],
        );
      });
    }
    await authorize(runId, signal);
    await db.query(
      "update public.research_runs set completed_samples=(select count(*) from public.observation_samples where run_id=$1 and state='complete'),state=case when (select count(*) from public.observation_samples where run_id=$1 and state='complete')=expected_samples then 'complete' when exists(select 1 from public.observation_samples where run_id=$1 and state='complete') then 'partial' else 'failed' end,completed_at=now() where id=$1 and state='collecting' and private.research_authorized($1)",
      [runId],
    );
  } else {
    if (!run.target_url) throw new ProviderError("AUDIT_URL_REQUIRED");
    const policy = await robotsPolicy(run.target_url, signal);
    const previous = await db.query(
      "select url,evidence from public.audit_checks where run_id=$1",
      [runId],
    );
    const checks = z
      .array(
        z.object({
          url: z.string(),
          evidence: z.object({ links: z.array(z.string()).optional() }),
        }),
      )
      .parse(previous.rows);
    const visited = new Set(checks.map((c) => c.url));
    const frontier = [
      run.target_url,
      ...checks.flatMap((c) => c.evidence.links ?? []),
    ];
    const queued = new Set(frontier);
    while (frontier.length && visited.size < 20) {
      const url = frontier.shift();
      if (!url || visited.has(url)) continue;
      await authorize(runId, signal);
      let status: number | null = null;
      let errorCode: string | null = null;
      let evidence: {
        links: string[];
        findings: ReturnType<typeof inspectHtml>["findings"];
        title?: string;
        final_url?: string;
      } = { links: [], findings: [] };
      try {
        if (!policy.allowed(url)) throw new ProviderError("ROBOTS_DISALLOWED");
        const page = await fetchPublicPage(url, signal);
        status = page.status;
        if (!page.contentType.toLowerCase().includes("text/html"))
          throw new ProviderError("AUDIT_NON_HTML");
        evidence = {
          ...inspectHtml(page.url, page.status, page.body),
          final_url: page.url,
        };
      } catch (error) {
        if (signal.aborted) throw error;
        errorCode =
          error instanceof ProviderError ? error.code : "AUDIT_FETCH_FAILED";
      }
      await transaction(async (client) => {
        await client.query(
          "select id from public.research_runs where id=$1 for update",
          [runId],
        );
        const allowed = await client.query<{ allowed: boolean }>(
          "select private.research_authorized($1) allowed",
          [runId],
        );
        if (!allowed.rows[0]?.allowed)
          throw new ProviderError("ACCESS_REVOKED");
        signal.throwIfAborted();
        await client.query(
          "insert into public.audit_checks(brand_id,run_id,url,status,error_code,evidence) values($1,$2,$3,$4,$5,$6) on conflict do nothing",
          [
            run.brand_id,
            runId,
            url,
            status,
            errorCode,
            JSON.stringify(evidence),
          ],
        );
        if (!errorCode) {
          for (const finding of evidence.findings)
            await client.query(
              "insert into public.audit_findings(brand_id,url,code,severity,explanation,evidence,last_run_id) values($1,$2,$3,$4,$5,$6,$7) on conflict(brand_id,url,code) do update set severity=excluded.severity,explanation=excluded.explanation,evidence=excluded.evidence,state='open',last_checked_at=now(),last_run_id=excluded.last_run_id",
              [
                run.brand_id,
                url,
                finding.code,
                finding.severity,
                finding.explanation,
                finding.evidence,
                runId,
              ],
            );
          if (status === 200)
            await client.query(
              "update public.audit_findings set state='resolved',last_checked_at=now(),last_run_id=$3 where brand_id=$1 and url=$2 and code<>all($4::text[])",
              [run.brand_id, url, runId, evidence.findings.map((f) => f.code)],
            );
        }
      });
      visited.add(url);
      for (const link of evidence.links)
        if (!queued.has(link) && queued.size < 200) {
          queued.add(link);
          frontier.push(link);
        }
      await delay(policy.delayMs, undefined, { signal });
    }
    await authorize(runId, signal);
    await db.query(
      "update public.research_runs set state=case when exists(select 1 from public.audit_checks where run_id=$1 and error_code is not null) or $2 then 'partial' else 'complete' end,completed_samples=(select count(*) from public.audit_checks where run_id=$1),completed_at=now() where id=$1 and state='collecting' and private.research_authorized($1)",
      [runId, frontier.length > 0],
    );
  }
}
export async function failResearch(runId: string, error: unknown) {
  const code = error instanceof ProviderError ? error.code : "RESEARCH_FAILED";
  await getDatabase().query(
    "update public.research_runs set state=case when $2='ACCESS_REVOKED' then 'cancelled' when exists(select 1 from public.observation_samples where run_id=$1 and state='complete') or exists(select 1 from public.audit_checks where run_id=$1) then 'partial' else 'failed' end,completed_samples=case when kind='observation' then (select count(*) from public.observation_samples where run_id=$1 and state='complete') else (select count(*) from public.audit_checks where run_id=$1) end,error_code=$2,completed_at=now() where id=$1 and state in ('scheduled','collecting')",
    [runId, code],
  );
}
