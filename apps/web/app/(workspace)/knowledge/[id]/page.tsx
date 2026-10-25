import { OpportunityForm } from "../../../../components/intelligence/forms";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getWorkspaceContext } from "../../../../lib/workspaces/context";
import { getFact } from "../../../../lib/knowledge/queries";
import { hasBrandCapability } from "../../../../lib/workspaces/permissions";
import type { PageParams } from "../../../../lib/agency/queries";
import { PageHeading } from "../../../../components/shared";
import {
  FactForm,
  ReviewFactForm,
} from "../../../../components/knowledge/forms";
export default async function FactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<PageParams>;
}) {
  const { activeBrand, selectionDenied } = await getWorkspaceContext();
  if (selectionDenied) return null;
  if (!activeBrand) notFound();
  const { id } = await params;
  const search = await searchParams;
  const [canWrite, canApprove, canRecommend, { fact, history, hasMore }] =
    await Promise.all([
      hasBrandCapability(activeBrand.id, "knowledge.write"),
      hasBrandCapability(activeBrand.id, "knowledge.approve"),
      hasBrandCapability(activeBrand.id, "opportunities.manage"),
      getFact(activeBrand.id, id, search),
    ]);
  const last = history.at(-1);
  return (
    <div className="page-content">
      <Link href="/knowledge">← Brand knowledge</Link>
      <PageHeading
        eyebrow={activeBrand.name}
        title="The fact."
        accent="And its provenance."
        description={`Version ${fact.version} · ${fact.state}`}
      />
      <section className="panel onboarding-panel">
        <h2>{fact.statement}</h2>
        <p>
          Owner: {fact.responsible_owner} · Review by {fact.review_on} (UTC)
        </p>
        <p>{fact.source_description}</p>
        {fact.source_url ? (
          <a href={fact.source_url} target="_blank" rel="noopener noreferrer">
            Open source reference ↗
          </a>
        ) : null}
        {fact.approved_at ? (
          <p>
            Approved {fact.approved_at} by {fact.approved_by}. Review date still
            applies.
          </p>
        ) : (
          <p>This version is not approved for use.</p>
        )}
      </section>
      {canWrite || canApprove ? (
        <>
          <section className="panel onboarding-panel">
            {canApprove && fact.state === "pending" ? (
              <ReviewFactForm fact={fact} decision="approved" />
            ) : null}
            {canApprove && fact.state !== "archived" ? (
              <ReviewFactForm fact={fact} decision="archived" />
            ) : null}
          </section>
          {canWrite ? (
            <section className="panel onboarding-panel">
              <details>
                <summary>Correct or renew this fact</summary>
                <FactForm
                  key={fact.version}
                  brandId={activeBrand.id}
                  requestId={randomUUID()}
                  fact={fact}
                />
              </details>
            </section>
          ) : null}
        </>
      ) : null}
      {canRecommend && fact.state === "approved" ? (
        <section className="panel onboarding-panel">
          <details>
            <summary>Create an opportunity from this fact</summary>
            <OpportunityForm
              brandId={activeBrand.id}
              requestId={randomUUID()}
              factId={fact.id}
              factVersion={fact.version}
            />
          </details>
        </section>
      ) : null}
      <section className="panel onboarding-panel">
        <h2>Version history</h2>
        <p>
          Every correction and review is retained. Dependent opportunities are
          flagged for review when their supporting fact changes.
        </p>
        {history.map((revision) => (
          <details key={revision.version}>
            <summary>
              Version {revision.version} · {revision.recorded_at}
            </summary>
            <p>Recorded by {revision.actor_id}</p>
            <p>
              <strong>{revision.snapshot.statement}</strong>
            </p>
            <p>
              {revision.snapshot.state} ·{" "}
              {revision.snapshot.category.replaceAll("_", " ")}
            </p>
            <p>Source: {revision.snapshot.source_description}</p>
            <p>
              Owner: {revision.snapshot.responsible_owner} · Review by{" "}
              {revision.snapshot.review_on}
            </p>
          </details>
        ))}
        {hasMore && last ? (
          <Link href={`/knowledge/${id}?before=${last.version}`}>
            Older versions
          </Link>
        ) : null}
      </section>
    </div>
  );
}
