import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceContext } from "../../../../lib/workspaces/context";
import { getReport } from "../../../../lib/intelligence/queries";
import { PageHeading } from "../../../../components/shared";
export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { activeBrand, selectionDenied } = await getWorkspaceContext();
  if (selectionDenied) return null;
  if (!activeBrand) notFound();
  const { id } = await params;
  const report = await getReport(activeBrand.id, id);
  const data = report.snapshot;
  return (
    <div className="page-content">
      <Link href="/reports">← Reports</Link>
      <PageHeading
        eyebrow={data.brand.name}
        title={report.title}
        accent="Preserved."
        description={`${data.filters.range_start} through ${data.filters.range_end} · ${data.filters.filter_timezone}`}
      />
      <a className="button primary" href={`/api/reports/${id}/download`}>
        Download snapshot (JSON)
      </a>
      <section className="panel onboarding-panel">
        <h2>Methodology and coverage</h2>
        <p>{data.methodology}</p>
        <p>
          Captured {data.captured_at}. Brand reporting timezone:{" "}
          {data.brand.reporting_timezone}.
        </p>
        <p>
          {data.coverage.opportunities} opportunities created within the
          selected UTC dates, across all statuses. Available daily metric
          records: {data.coverage.analytics ?? "unavailable"}. Completed
          observation samples: {data.coverage.observations ?? "unavailable"}.
          These are coverage counts; compare mention rates only within a fixed
          run.
        </p>
        <h3>Annotations</h3>
        <p>{report.annotation || "No annotations recorded."}</p>
      </section>
      <section className="panel onboarding-panel">
        <h2>Source availability at capture</h2>
        {data.sources.length ? (
          data.sources.map((source, index) => (
            <p key={index}>
              {source.provider} · {source.account} · {source.reference} ·{" "}
              {source.state.replaceAll("_", " ")}
            </p>
          ))
        ) : (
          <p>No source records saved at capture.</p>
        )}
      </section>
      {data.analytics_days.length ? (
        <section className="panel onboarding-panel">
          <h2>Captured daily metrics</h2>
          {data.analytics_days.map((day) => (
            <article key={day.id}>
              <h3>
                {day.provider} · {day.observed_date} · {day.provider_timezone}
              </h3>
              {day.metrics === null ? (
                <p>Unavailable</p>
              ) : (
                <p>
                  {Object.entries(day.metrics)
                    .map(([key, value]) => `${key}: ${value}`)
                    .join(" · ")}
                </p>
              )}
              <p>Captured {day.captured_at}</p>
            </article>
          ))}
        </section>
      ) : null}
      {data.research_runs.map((run) => (
        <section className="panel onboarding-panel" key={run.id}>
          <h2>
            {run.kind} · {run.state}
          </h2>
          <p>Requested {run.created_at}</p>
          {run.kind === "observation" ? (
            <p>
              {run.samples.filter((s) => s.state === "complete").length}{" "}
              completed / {run.expected_samples} planned samples. Compare
              subjects only within this run.
            </p>
          ) : (
            <p>{run.checks.length} recorded page checks.</p>
          )}
          {run.samples.map((sample) => (
            <details key={sample.id}>
              <summary>
                {sample.question} · {sample.state} ·{" "}
                {sample.actual_model ?? "Model unavailable"}
              </summary>
              <blockquote className="observation-answer">
                {sample.answer ?? "No usable answer"}
              </blockquote>
              <p>Observed {sample.observed_at}</p>
              <p>
                {Object.entries(sample.mentions)
                  .map(
                    ([subject, mentioned]) =>
                      `${subject}: ${mentioned ? "matching text" : "no matching text"}`,
                  )
                  .join(" · ")}
              </p>
            </details>
          ))}
          {run.checks.map((check, index) => (
            <p key={index}>
              {check.url} · HTTP {check.status ?? "unavailable"}
              {check.error_code ? ` · ${check.error_code}` : ""}
            </p>
          ))}
          <p>
            Full methodology, cohort settings and evidence are preserved in the
            JSON snapshot.
          </p>
        </section>
      ))}
      {data.opportunities.map((item) => (
        <section className="panel onboarding-panel" key={item.id}>
          <h2>{item.title}</h2>
          <p>
            {item.state.replaceAll("_", " ")} · Priority {item.priority} ·{" "}
            {item.effort} effort
          </p>
          <p>{item.problem}</p>
          <p>Affected: {item.affected_reference}</p>
          <h3>Proposed action</h3>
          <p>{item.proposed_action}</p>
          <p>Uncertainty: {item.confidence_reason}</p>
          <p>Relevance: {item.business_relevance}</p>
          <h3>Evidence version {item.evidence.version}</h3>
          <p>{item.evidence.statement}</p>
          <p>
            {item.evidence.source_description} · Review by{" "}
            {item.evidence.review_on}
          </p>
          {item.evidence_needs_review ? (
            <p className="notice">
              Evidence needed review when this report was captured.
            </p>
          ) : null}
          <p>
            {item.history.length} activity records preserved in the download.
          </p>
        </section>
      ))}
    </div>
  );
}
