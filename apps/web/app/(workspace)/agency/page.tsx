import { randomUUID } from "node:crypto";
import Link from "next/link";
import { AgencyForm } from "../../../components/agency/forms";
import { PageHeading } from "../../../components/shared";
import { getAgencies } from "../../../lib/agency/queries";
export default async function AgencyPage() {
  const agencies = await getAgencies();
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="YOUR ORGANIZATION"
        title="An agency."
        accent="Independent ownership."
        description="Create your agency, then accept invitations to client brands. Their ownership and billing remain separate."
      />
      <section className="panel onboarding-panel">
        <AgencyForm requestId={randomUUID()} />
      </section>
      <section className="panel onboarding-panel">
        <h2>Your agencies</h2>
        <p>
          <Link href="/claims">Prepare an unclaimed client workspace</Link>
        </p>
        {agencies.length ? (
          agencies.map((agency) => (
            <p key={agency.id}>
              <strong>{agency.name}</strong>
              <br />
              <code>{agency.id}</code> ·{" "}
              <Link href={`/agency/${agency.id}/staff`}>Manage staff</Link>
            </p>
          ))
        ) : (
          <p>No agency has been created for this account.</p>
        )}
        <Link className="button outline" href="/invitations">
          View invitations
        </Link>
      </section>
    </div>
  );
}
