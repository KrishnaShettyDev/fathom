import Link from "next/link";
import { getWorkspaceContext } from "../../../lib/workspaces/context";
import { listOpportunities } from "../../../lib/intelligence/queries";
import { nextPage, type PageParams } from "../../../lib/agency/queries";
import { PageHeading } from "../../../components/shared";
export default async function OpportunitiesPage({
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
  const { rows, hasMore } = await listOpportunities(
    activeBrand.id,
    await searchParams,
  );
  const last = rows.at(-1);
  return (
    <div className="page-content">
      <PageHeading
        eyebrow={activeBrand.name}
        title="Decide what matters."
        accent="Then track the work."
        description="Evidence-backed recommendations with explicit uncertainty, effort and ownership. Priorities are human judgments, not revenue forecasts."
      />
      <Link className="button outline" href="/knowledge">
        Create from an approved brand fact
      </Link>
      {rows.length ? (
        rows.map((item) => (
          <article className="panel onboarding-panel" key={item.id}>
            <span className="tag">
              {item.state.replaceAll("_", " ")} ·{" "}
              {["High", "Medium", "Low"][item.priority - 1]} priority
            </span>
            <h2>
              <Link href={`/opportunities/${item.id}`}>{item.title}</Link>
            </h2>
            <p>{item.problem}</p>
            <p>
              Effort: {item.effort} · Assignee:{" "}
              {item.assignee_id ?? "Unassigned"}
            </p>
            {item.evidence_needs_review ? (
              <p className="notice">
                Supporting fact changed. Evidence review required.
              </p>
            ) : null}
            {item.snooze_until ? (
              <p>Snoozed until {item.snooze_until}. Reopen when ready.</p>
            ) : null}
          </article>
        ))
      ) : (
        <section className="panel onboarding-panel">
          <h2>No opportunities yet.</h2>
          <p>
            Open an approved fact in Brand Knowledge to record a recommendation
            with its evidence.
          </p>
        </section>
      )}
      {hasMore && last ? (
        <Link href={nextPage("/opportunities", last)}>Older opportunities</Link>
      ) : null}
    </div>
  );
}
