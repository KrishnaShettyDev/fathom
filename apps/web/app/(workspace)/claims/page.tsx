import { randomUUID } from "node:crypto";
import Link from "next/link";
import { requireUser } from "../../../lib/auth/session";
import {
  getAgencies,
  readCursor,
  cursorFilter,
  nextPage,
  type PageParams,
} from "../../../lib/agency/queries";
import { PageHeading } from "../../../components/shared";
import {
  CreateClaimForm,
  AcceptClaimForm,
  CloseClaimForm,
} from "../../../components/agency/claim-forms";
export default async function ClaimsPage({
  searchParams,
}: {
  searchParams: Promise<PageParams>;
}) {
  const { client, user } = await requireUser();
  const cursor = readCursor(await searchParams);
  let query = client
    .from("brand_claim_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(26);
  if (cursor) query = query.or(cursorFilter(cursor));
  const [claims, agencies] = await Promise.all([query, getAgencies()]);
  if (claims.error) throw new Error("Brand claims could not be loaded.");
  const rows = claims.data.slice(0, 25);
  const last = rows.at(-1);
  return (
    <div className="page-content">
      <Link href="/agency">← Agencies</Link>
      <PageHeading
        eyebrow="OWNERSHIP BEFORE OPERATIONS"
        title="Unclaimed client setup."
        accent="Verified acceptance."
        description="An agency may prepare setup. Only the named recipient’s verified account and explicit ownership attestation can create the owner workspace. This never transfers an existing brand."
      />
      {agencies.length ? (
        <section className="panel onboarding-panel">
          <CreateClaimForm agencies={agencies} requestId={randomUUID()} />
        </section>
      ) : null}
      {rows.map((claim) => (
        <section key={claim.id} className="panel onboarding-panel">
          <h2>{claim.brand_name}</h2>
          <p>
            Agency {claim.agency_id} · Recipient {claim.owner_email}
          </p>
          <p>
            {claim.website ?? "Website not supplied"} ·{" "}
            {claim.reporting_timezone}
          </p>
          <p>
            {claim.state} · expires {claim.expires_at}
          </p>
          {claim.decision_reason ? <p>{claim.decision_reason}</p> : null}
          {claim.state === "unclaimed" ? (
            <>
              {claim.owner_email === user.email?.toLowerCase() ? (
                <AcceptClaimForm id={claim.id} name={claim.brand_name} />
              ) : (
                <p>
                  Awaiting the named owner. No brand operations are authorized
                  by this request.
                </p>
              )}
              <details>
                <summary>Cancel or dispute</summary>
                <CloseClaimForm id={claim.id} />
              </details>
            </>
          ) : null}
          {claim.state === "claimed" ? (
            <p>
              Owner workspace created. The owner controls agency invitations
              separately.
            </p>
          ) : null}
        </section>
      ))}
      {!rows.length ? <p>No visible claim requests.</p> : null}
      {claims.data.length > 25 && last ? (
        <Link href={nextPage("/claims", last)}>Older requests</Link>
      ) : null}
    </div>
  );
}
