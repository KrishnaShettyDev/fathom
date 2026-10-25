import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getWorkspaceContext } from "../../../../lib/workspaces/context";
import { requireUser } from "../../../../lib/auth/session";

import { hasBrandCapability } from "../../../../lib/workspaces/permissions";
import { revisionSnapshotSchema } from "../../../../lib/knowledge/validation";
import { getOpportunity } from "../../../../lib/intelligence/queries";
import { nextPage, type PageParams } from "../../../../lib/agency/queries";
import { PageHeading } from "../../../../components/shared";
import {
  WorkflowForm,
  CommentForm,
  EvidenceReviewForm,
} from "../../../../components/intelligence/forms";
const eventSchema = z.object({
  body: z.string().optional(),
  state: z.string().optional(),
  reason: z.string().optional(),
  fact_version: z.number().optional(),
});
export default async function OpportunityPage({
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
  const [{ opportunity: item, fact, events, hasMore }, canManage, { client }] =
    await Promise.all([
      getOpportunity(activeBrand.id, id, await searchParams),
      hasBrandCapability(activeBrand.id, "opportunities.manage"),
      requireUser(),
    ]);
  const assignees = canManage
    ? await client.rpc("list_opportunity_assignees", {
        target_brand: activeBrand.id,
      })
    : null;
  if (assignees?.error) throw new Error("Assignees could not be loaded.");
  const evidence = revisionSnapshotSchema.parse(fact);
  const last = events.at(-1);
  return (
    <div className="page-content">
      <Link href="/opportunities">← Opportunities</Link>
      <PageHeading
        eyebrow={activeBrand.name}
        title={item.title}
        accent={item.state.replaceAll("_", " ")}
        description={`Version ${item.version} · ${item.effort} effort · Priority ${item.priority}`}
      />
      <section className="panel onboarding-panel">
        <h2>Problem</h2>
        <p>{item.problem}</p>
        <p>Affected: {item.affected_reference}</p>
        <h2>Proposed action</h2>
        <p>{item.proposed_action}</p>
        <h2>Evidence and uncertainty</h2>
        <p>{item.confidence_reason}</p>
        <h2>Business relevance</h2>
        <p>{item.business_relevance}</p>
      </section>
      <section className="panel onboarding-panel">
        <h2>Supporting fact · version {item.fact_version}</h2>
        <p>{evidence.statement}</p>
        <p>Source: {evidence.source_description}</p>
        <p>Review by {evidence.review_on} (UTC)</p>
        <Link href={`/knowledge/${item.fact_id}`}>
          Inspect current fact and source history
        </Link>
        {item.evidence_needs_review ? (
          <p className="notice">
            This recommendation references an older fact version. Review the
            current fact before continuing.
          </p>
        ) : null}
        {canManage ? (
          <EvidenceReviewForm key={item.version} item={item} />
        ) : null}
      </section>
      {canManage ? (
        <section className="panel onboarding-panel">
          <h2>Manage work</h2>
          <WorkflowForm
            key={item.version}
            item={item}
            assignees={assignees?.data ?? []}
          />
          <CommentForm item={item} />
        </section>
      ) : null}
      <section className="panel onboarding-panel">
        <h2>Activity</h2>
        {events.map((event) => {
          const detail = eventSchema.parse(event.details);
          return (
            <article key={event.id}>
              <h3>
                {event.event_type.replaceAll("_", " ")} · {event.created_at}
              </h3>
              <p>By {event.actor_id}</p>
              {detail.body ? <p>{detail.body}</p> : null}
              {detail.state ? <p>Status: {detail.state}</p> : null}
              {detail.reason ? <p>Reason: {detail.reason}</p> : null}
              {detail.fact_version ? (
                <p>Evidence version: {detail.fact_version}</p>
              ) : null}
            </article>
          );
        })}
        {hasMore && last ? (
          <Link href={nextPage(`/opportunities/${id}`, last)}>
            Older activity
          </Link>
        ) : null}
      </section>
    </div>
  );
}
