import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getWorkspaceContext } from "../../../lib/workspaces/context";

import { hasBrandCapability } from "../../../lib/workspaces/permissions";
import { listReports } from "../../../lib/intelligence/queries";
import { nextPage, type PageParams } from "../../../lib/agency/queries";
import { PageHeading } from "../../../components/shared";
import { ReportForm } from "../../../components/intelligence/forms";
export default async function ReportsPage({
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
  const [{ rows, hasMore }, canManage] = await Promise.all([
    listReports(activeBrand.id, await searchParams),
    hasBrandCapability(activeBrand.id, "reports.create"),
  ]);
  const last = rows.at(-1);
  return (
    <div className="page-content">
      <PageHeading
        eyebrow={activeBrand.name}
        title="A clear record."
        accent="A fixed point in time."
        description="Immutable workflow reports preserve the selected range, supporting evidence, decisions and known gaps."
      />
      {canManage ? (
        <section className="panel onboarding-panel">
          <details>
            <summary>Create a report</summary>
            <ReportForm brandId={activeBrand.id} requestId={randomUUID()} />
          </details>
        </section>
      ) : null}
      {rows.length ? (
        rows.map((report) => (
          <article className="panel onboarding-panel" key={report.id}>
            <h2>
              <Link href={`/reports/${report.id}`}>{report.title}</Link>
            </h2>
            <p>
              {report.range_start} through {report.range_end} · UTC creation
              dates
            </p>
            <p>Captured {report.created_at}</p>
          </article>
        ))
      ) : (
        <section className="panel onboarding-panel">
          <h2>No reports created.</h2>
          <p>Create a dated workflow snapshot after reviewing your evidence.</p>
        </section>
      )}
      {hasMore && last ? (
        <Link href={nextPage("/reports", last)}>Older reports</Link>
      ) : null}
    </div>
  );
}
