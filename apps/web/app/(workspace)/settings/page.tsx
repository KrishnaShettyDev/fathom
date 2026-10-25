import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getWorkspaceContext } from "../../../lib/workspaces/context";
import { requireUser } from "../../../lib/auth/session";

import { hasBrandCapability } from "../../../lib/workspaces/permissions";
import { PageHeading } from "../../../components/shared";
import {
  WorkspaceSettings,
  BaselineReview,
} from "../../../components/workspace-settings";
export default async function SettingsPage() {
  const { activeBrand, selectionDenied } = await getWorkspaceContext();
  if (selectionDenied) return null;
  if (!activeBrand)
    return (
      <div className="page-content">
        <h1>Choose a brand first.</h1>
        <Link href="/">Open workspace</Link>
      </div>
    );
  const { client } = await requireUser();
  const [canManage, reviews] = await Promise.all([
    hasBrandCapability(activeBrand.id),
    client
      .from("baseline_reviews")
      .select("*")
      .eq("brand_id", activeBrand.id)
      .order("acknowledged_at", { ascending: false })
      .limit(10),
  ]);
  if (reviews.error) throw new Error("Baseline reviews could not be loaded.");
  return (
    <div className="page-content">
      <PageHeading
        eyebrow={activeBrand.name}
        title="Workspace settings."
        accent="A reviewed baseline."
        description="Maintain your website and reporting context. Record what is monitored, what is missing, and who is responsible."
      />
      {canManage ? (
        <>
          <section className="panel onboarding-panel">
            <h2>Brand settings</h2>
            <p>
              <a
                href={`/api/brands/${activeBrand.id}/export`}
                className="button outline"
              >
                Export brand records (NDJSON)
              </a>
            </p>
            <p>
              The export includes brand evidence and history, excludes
              credentials, and requires a final completion record. An
              interrupted download is incomplete.
            </p>
            <WorkspaceSettings brand={activeBrand} />
          </section>
          <section className="panel onboarding-panel">
            <h2>Review your baseline</h2>
            <p>
              Inspect <Link href="/connections">source health</Link>,{" "}
              <Link href="/analytics">analytics</Link>,{" "}
              <Link href="/audit">audit findings</Link> and{" "}
              <Link href="/visibility">observations</Link> before acknowledging.
            </p>
            <BaselineReview brandId={activeBrand.id} requestId={randomUUID()} />
          </section>
        </>
      ) : (
        <p>
          Brand owner permission is required to change settings or acknowledge a
          baseline.
        </p>
      )}
      <section className="panel onboarding-panel">
        <h2>Latest 10 acknowledgements</h2>
        {reviews.data.length ? (
          reviews.data.map((review) => (
            <article key={review.id}>
              <h3>{review.acknowledged_at}</h3>
              <p>Recorded by {review.actor_id}</p>
              <h4>Monitoring scope</h4>
              <p>{review.monitoring_scope}</p>
              <h4>Data gaps</h4>
              <p>{review.data_gaps}</p>
              <h4>Responsibilities</h4>
              <p>{review.responsibilities}</p>
              <details>
                <summary>Evidence counts and source health at review</summary>
                <pre className="observation-answer">
                  {JSON.stringify(review.snapshot, null, 2)}
                </pre>
              </details>
            </article>
          ))
        ) : (
          <p>No baseline has been acknowledged.</p>
        )}
      </section>
    </div>
  );
}
