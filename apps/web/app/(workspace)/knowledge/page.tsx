import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getWorkspaceContext } from "../../../lib/workspaces/context";
import { listFacts } from "../../../lib/knowledge/queries";
import { hasBrandCapability } from "../../../lib/workspaces/permissions";
import { nextPage, type PageParams } from "../../../lib/agency/queries";
import { PageHeading } from "../../../components/shared";
import { FactForm } from "../../../components/knowledge/forms";
export default async function KnowledgePage({
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
  const [canManage, { rows, hasMore }] = await Promise.all([
    hasBrandCapability(activeBrand.id, "knowledge.write"),
    listFacts(activeBrand.id, params),
  ]);
  const last = rows.at(-1);
  return (
    <div className="page-content">
      <PageHeading
        eyebrow={activeBrand.name}
        title="Your knowledge."
        accent="Grounded in facts."
        description="Capture what your team knows, preserve its source, and approve each version deliberately."
      />
      {canManage ? (
        <section className="panel onboarding-panel">
          <details>
            <summary>Add a sourced fact</summary>
            <FactForm brandId={activeBrand.id} requestId={randomUUID()} />
          </details>
        </section>
      ) : (
        <p>
          Read-only access. A brand manager can add, correct and approve facts.
        </p>
      )}
      <section className="knowledge-list">
        {rows.length ? (
          rows.map((fact) => (
            <article className="panel onboarding-panel" key={fact.id}>
              <span className="tag">
                {fact.state} · Version {fact.version}
              </span>
              <h2>
                <Link href={`/knowledge/${fact.id}`}>{fact.statement}</Link>
              </h2>
              <p>
                {fact.category.replaceAll("_", " ")} · Owner:{" "}
                {fact.responsible_owner}
              </p>
              <p>
                Review by {fact.review_on} (UTC).{" "}
                {fact.state === "approved"
                  ? "Approval does not extend this review date."
                  : "Not approved for use."}
              </p>
              <p>Source: {fact.source_description}</p>
            </article>
          ))
        ) : (
          <div className="panel onboarding-panel">
            <h2>No facts recorded.</h2>
            <p>
              Add verified business context with its source. Nothing is inferred
              or generated.
            </p>
          </div>
        )}
      </section>
      {hasMore && last ? (
        <Link href={nextPage("/knowledge", last)}>Older facts</Link>
      ) : null}
    </div>
  );
}
