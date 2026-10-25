import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getWorkspaceContext } from "../../../lib/workspaces/context";
import { requireUser } from "../../../lib/auth/session";

import { hasBrandCapability } from "../../../lib/workspaces/permissions";
import { PageHeading } from "../../../components/shared";
import { ResearchRequestForm } from "../../../components/research-forms";
import type { PageParams } from "../../../lib/agency/queries";
export default async function AuditPage({
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
    .from("audit_findings")
    .select("*")
    .eq("brand_id", activeBrand.id)
    .order("id")
    .limit(26);
  if (after?.success) query = query.gt("id", after.data);
  const [findings, runs, canManage] = await Promise.all([
    query,
    client
      .from("research_runs")
      .select("id,state,created_at,error_code")
      .eq("brand_id", activeBrand.id)
      .eq("kind", "audit")
      .order("created_at", { ascending: false })
      .limit(10),
    hasBrandCapability(activeBrand.id),
  ]);
  if (findings.error || runs.error)
    throw new Error("Audit evidence could not be loaded.");
  const rows = findings.data.slice(0, 25);
  const last = rows.at(-1);
  return (
    <div className="page-content">
      <PageHeading
        eyebrow={activeBrand.name}
        title="Inspect the website."
        accent="Keep the evidence."
        description="A bounded static-HTML audit of the saved brand website. Findings are observations to review, not promises of ranking or revenue gains."
      />
      <section className="panel onboarding-panel">
        <h2>{activeBrand.website ?? "No website saved"}</h2>
        <p>
          Up to 20 same-site pages, public addresses only, robots.txt respected,
          no script execution. A recheck preserves history and resolves findings
          only when a successful page check verifies the issue is absent.
        </p>
        {canManage && activeBrand.website ? (
          <ResearchRequestForm
            brandId={activeBrand.id}
            kind="audit"
            requestId={randomUUID()}
            target={`${activeBrand.name} · ${activeBrand.website}`}
          />
        ) : null}
        <Link href="/settings">Edit brand website</Link>
      </section>
      <section className="panel onboarding-panel">
        <h2>Latest 10 audits</h2>
        {runs.data.length ? (
          runs.data.map((run) => (
            <p key={run.id}>
              <Link href={`/research/${run.id}`}>
                {run.created_at} · {run.state}
              </Link>
              {run.error_code ? ` · ${run.error_code}` : ""}
            </p>
          ))
        ) : (
          <p>No audit has run.</p>
        )}
      </section>
      {rows.map((finding) => (
        <article className="panel onboarding-panel" key={finding.id}>
          <span className="tag">
            {finding.state} · {finding.severity}
          </span>
          <h2>{finding.code.replaceAll("_", " ")}</h2>
          <p>{finding.url}</p>
          <p>{finding.explanation}</p>
          <blockquote>{finding.evidence}</blockquote>
          <p>
            First observed {finding.first_seen_at}; last checked{" "}
            {finding.last_checked_at}.
          </p>
          <Link href={`/research/${finding.last_run_id}`}>
            Inspect check evidence
          </Link>
        </article>
      ))}
      {!rows.length ? (
        <section className="panel onboarding-panel">
          <p>
            No findings on this page. This does not establish coverage before an
            audit completes.
          </p>
        </section>
      ) : null}
      {findings.data.length > 25 && last ? (
        <Link href={`/audit?after=${last.id}`}>More findings</Link>
      ) : null}
    </div>
  );
}
