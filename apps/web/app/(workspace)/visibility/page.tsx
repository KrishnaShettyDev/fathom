import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getWorkspaceContext } from "../../../lib/workspaces/context";
import { requireUser } from "../../../lib/auth/session";

import { hasBrandCapability } from "../../../lib/workspaces/permissions";
import { PageHeading } from "../../../components/shared";
import {
  CohortForm,
  ResearchRequestForm,
  ObservationAllowanceForm,
  ScheduleCohortForm,
} from "../../../components/research-forms";
import type { PageParams } from "../../../lib/agency/queries";
export default async function VisibilityPage({
  searchParams,
}: {
  searchParams: Promise<PageParams>;
}) {
  const { activeBrand, selectionDenied } = await getWorkspaceContext();
  if (selectionDenied) return null;
  if (!activeBrand)
    return (
      <div className="page-content">
        <h1>Choose a brand first.</h1>
        <Link href="/">Open workspace</Link>
      </div>
    );
  const params = await searchParams;
  const after =
    params.after === undefined ? null : z.uuid().safeParse(params.after);
  if (after && !after.success) notFound();
  const { client } = await requireUser();
  let query = client
    .from("observation_cohorts")
    .select("*")
    .eq("brand_id", activeBrand.id)
    .order("id")
    .limit(26);
  if (after?.success) query = query.gt("id", after.data);
  const [cohorts, runs, allowance, canManage] = await Promise.all([
    query,
    client
      .from("research_runs")
      .select("id,state,created_at,completed_samples,expected_samples")
      .eq("brand_id", activeBrand.id)
      .eq("kind", "observation")
      .order("created_at", { ascending: false })
      .limit(10),
    client
      .from("collection_allowances")
      .select("monthly_observation_limit")
      .eq("brand_id", activeBrand.id)
      .maybeSingle(),
    hasBrandCapability(activeBrand.id),
  ]);
  if (cohorts.error || runs.error || allowance.error)
    throw new Error("Observation cohorts could not be loaded.");
  const rows = cohorts.data.slice(0, 25);
  const last = rows.at(-1);
  const configured =
    process.env.OBSERVATIONS_ENABLED === "true" &&
    !!process.env.OBSERVATION_MODEL;
  return (
    <div className="page-content">
      <PageHeading
        eyebrow={activeBrand.name}
        title="Sampled answers."
        accent="Inspectable evidence."
        description="Fixed API question cohorts. Missing or failed samples affect coverage, not a brand's mention rate. These are not consumer-interface observations or measured demand."
      />
      {canManage ? (
        <>
          <section className="panel onboarding-panel">
            <details>
              <summary>Create a fixed cohort</summary>
              <CohortForm
                brandId={activeBrand.id}
                model={process.env.OBSERVATION_MODEL ?? ""}
              />
            </details>
          </section>
          <section className="panel onboarding-panel">
            <ObservationAllowanceForm
              brandId={activeBrand.id}
              limit={allowance.data?.monthly_observation_limit ?? 0}
            />
          </section>
        </>
      ) : null}
      <section className="panel onboarding-panel">
        <h2>Latest 10 runs</h2>
        {runs.data.length ? (
          runs.data.map((run) => (
            <p key={run.id}>
              <Link href={`/research/${run.id}`}>
                {run.created_at} · {run.state}
              </Link>{" "}
              · {run.completed_samples}/{run.expected_samples} completed samples
            </p>
          ))
        ) : (
          <p>No observations collected.</p>
        )}
      </section>
      {rows.map((cohort) => (
        <section className="panel onboarding-panel" key={cohort.id}>
          <h2>{cohort.name}</h2>
          <p>
            {cohort.market} · {cohort.language} · Model: {cohort.model}
          </p>
          <p>Requested geography only; execution geography is not verified.</p>
          <p>Compared subjects: {cohort.subjects.join(", ")}</p>
          <ol>
            {cohort.questions.map((question, index) => (
              <li key={index}>{question}</li>
            ))}
          </ol>
          <p>
            {cohort.samples} samples per question ·{" "}
            {cohort.samples * cohort.questions.length} requests per run.
          </p>
          <p>
            Schedule:{" "}
            {cohort.scheduled
              ? `Every ${cohort.interval_days} days; next ${cohort.next_run_at}`
              : "Disabled"}
          </p>
          {canManage ? (
            <>
              <ResearchRequestForm
                brandId={activeBrand.id}
                kind="observation"
                cohort={cohort.id}
                requestId={randomUUID()}
                target={`${activeBrand.name} · ${cohort.name}`}
                enabled={
                  configured && cohort.model === process.env.OBSERVATION_MODEL
                }
              />
              <ScheduleCohortForm
                brandId={activeBrand.id}
                cohort={cohort.id}
                days={cohort.interval_days}
                enabled={cohort.scheduled}
              />
            </>
          ) : null}
        </section>
      ))}
      {!rows.length ? (
        <section className="panel onboarding-panel">
          <p>
            No question cohorts saved. Add your actual business questions and
            comparison subjects.
          </p>
        </section>
      ) : null}
      {cohorts.data.length > 25 && last ? (
        <Link href={`/visibility?after=${last.id}`}>More cohorts</Link>
      ) : null}
    </div>
  );
}
