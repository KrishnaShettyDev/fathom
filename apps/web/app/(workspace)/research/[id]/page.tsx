import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getWorkspaceContext } from "../../../../lib/workspaces/context";
import { requireUser } from "../../../../lib/auth/session";

import { hasBrandCapability } from "../../../../lib/workspaces/permissions";
import { PageHeading } from "../../../../components/shared";
import { CancelResearchForm } from "../../../../components/research-forms";
const cohortSchema = z.object({
  subjects: z.array(z.string()),
  questions: z.array(z.string()),
  model: z.string(),
  market: z.string(),
  language: z.string(),
  method: z.string(),
  parser_version: z.string(),
});
const auditSchema = z.object({
  title: z.string().optional(),
  final_url: z.string().optional(),
  findings: z
    .array(
      z.object({
        code: z.string(),
        explanation: z.string(),
        evidence: z.string(),
      }),
    )
    .optional(),
});
export default async function ResearchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { activeBrand, selectionDenied } = await getWorkspaceContext();
  if (selectionDenied) return null;
  if (!activeBrand) notFound();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { client } = await requireUser();
  const [result, canManage] = await Promise.all([
    client
      .from("research_runs")
      .select("*")
      .eq("brand_id", activeBrand.id)
      .eq("id", id)
      .maybeSingle(),
    hasBrandCapability(activeBrand.id),
  ]);
  if (result.error) throw new Error("Research run could not be loaded.");
  if (!result.data) notFound();
  const run = result.data;
  const [samples, checks] = await Promise.all([
    client
      .from("observation_samples")
      .select("*")
      .eq("brand_id", activeBrand.id)
      .eq("run_id", id)
      .order("ordinal")
      .limit(15),
    client
      .from("audit_checks")
      .select("*")
      .eq("brand_id", activeBrand.id)
      .eq("run_id", id)
      .order("checked_at")
      .limit(20),
  ]);
  if (samples.error || checks.error)
    throw new Error("Research evidence could not be loaded.");
  const cohort =
    run.kind === "observation" ? cohortSchema.parse(run.snapshot) : null;
  const completed = samples.data.filter(
    (sample) => sample.state === "complete",
  );
  return (
    <div className="page-content">
      <Link href={run.kind === "audit" ? "/audit" : "/visibility"}>
        ← {run.kind === "audit" ? "Website audit" : "Observation cohorts"}
      </Link>
      <PageHeading
        eyebrow={activeBrand.name}
        title={
          run.kind === "audit" ? "The website check." : "The observation run."
        }
        accent={run.state}
        description={`Requested ${run.created_at} · ${run.completed_at ? `Finished ${run.completed_at}` : "Not finished"}`}
      />
      <section className="panel onboarding-panel">
        <p>
          Freshness deadline: {run.fresh_until ?? "Not set"}. After this
          timestamp, treat this run as stale evidence of current conditions.
        </p>
        {run.error_code ? (
          <p className="notice">{run.error_code.replaceAll("_", " ")}</p>
        ) : null}
        {canManage && ["scheduled", "collecting"].includes(run.state) ? (
          <CancelResearchForm brandId={activeBrand.id} runId={id} />
        ) : null}
        <p>Refresh this page to load new worker results.</p>
      </section>
      {cohort ? (
        <>
          <section className="panel onboarding-panel">
            <h2>Methodology and coverage</h2>
            <p>
              {cohort.method} · Requested model: {cohort.model} · Parser:{" "}
              {cohort.parser_version}
            </p>
            <p>
              Requested context: {cohort.market} / {cohort.language}. Execution
              geography is unverified. No consumer-interface observation or
              web-search claim is made.
            </p>
            <p>
              Coverage: {completed.length} completed / {run.expected_samples}{" "}
              planned samples. {samples.data.length - completed.length} failed
              or unknown outcomes recorded. Incomplete samples are excluded from
              all mention denominators.
            </p>
            <p>
              Mentions use exact normalized text matches; ambiguous names are
              not disambiguated. These counts are not search demand, market
              share, or proof of recommendation.
            </p>
            <table>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Answers with matching text</th>
                  <th>Eligible answers</th>
                  <th>Sample mention rate</th>
                </tr>
              </thead>
              <tbody>
                {cohort.subjects.map((subject) => {
                  const count = completed.filter(
                    (sample) =>
                      z.record(z.string(), z.boolean()).parse(sample.mentions)[
                        subject
                      ] === true,
                  ).length;
                  return (
                    <tr key={subject}>
                      <th>{subject}</th>
                      <td>{count}</td>
                      <td>{completed.length}</td>
                      <td>
                        {completed.length
                          ? `${((100 * count) / completed.length).toFixed(1)}%`
                          : "Unavailable"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p>
              Every subject uses this exact run and the same eligible answers.
              Comparisons across different cohorts or windows are not combined.
            </p>
          </section>
          {samples.data.map((sample) => (
            <article className="panel onboarding-panel" key={sample.id}>
              <h2>
                Sample {sample.ordinal + 1}: {sample.question}
              </h2>
              <p>
                {sample.state} · {sample.observed_at} · Actual model:{" "}
                {sample.actual_model ?? "Unavailable"}
              </p>
              {sample.answer !== null ? (
                <blockquote className="observation-answer">
                  {sample.answer}
                </blockquote>
              ) : (
                <p>
                  No usable answer: {sample.error_code ?? "Unknown outcome"}.
                </p>
              )}
              <p>
                Provider response reference:{" "}
                {sample.provider_response_id ?? "Unavailable"}. Citations were
                not collected by this adapter.
              </p>
            </article>
          ))}
        </>
      ) : (
        <>
          <section className="panel onboarding-panel">
            <h2>Audit scope</h2>
            <p>{run.target_url}</p>
            <p>
              {checks.data.length} recorded checks, capped at 20 same-site
              pages. Static HTML only; scripts are not executed. Partial or
              blocked checks do not establish site-wide absence of issues.
            </p>
          </section>
          {checks.data.map((check) => {
            const evidence = auditSchema.parse(check.evidence);
            return (
              <article className="panel onboarding-panel" key={check.id}>
                <h2>{check.url}</h2>
                <p>
                  Checked {check.checked_at} · HTTP{" "}
                  {check.status ?? "unavailable"}
                </p>
                {check.error_code ? (
                  <p className="notice">
                    {check.error_code.replaceAll("_", " ")}
                  </p>
                ) : null}
                <p>Final URL: {evidence.final_url ?? "Unavailable"}</p>
                {evidence.findings?.map((finding) => (
                  <div key={finding.code}>
                    <h3>{finding.code.replaceAll("_", " ")}</h3>
                    <p>{finding.explanation}</p>
                    <blockquote>{finding.evidence}</blockquote>
                  </div>
                ))}
                {!check.error_code && !evidence.findings?.length ? (
                  <p>No findings from the implemented static checks.</p>
                ) : null}
              </article>
            );
          })}
        </>
      )}
      <section className="panel onboarding-panel">
        <p>
          Use this evidence to record a sourced fact for review before creating
          a recommendation.
        </p>
        <Link className="button outline" href="/knowledge">
          Open Brand Knowledge
        </Link>
      </section>
    </div>
  );
}
