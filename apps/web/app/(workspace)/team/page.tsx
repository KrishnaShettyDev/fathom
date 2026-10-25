import { AgencyCapabilitiesForm } from "../../../components/agency/capabilities-form";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import {
  CancelInvitationForm,
  InvitationForm,
  RevokeAccessForm,
} from "../../../components/agency/forms";
import { PageHeading } from "../../../components/shared";
import { requireUser } from "../../../lib/auth/session";
import { getWorkspaceContext } from "../../../lib/workspaces/context";
import {
  accessLabel,
  cursorFilter,
  nextPage,
  readCursor,
  type PageParams,
} from "../../../lib/agency/queries";
export default async function TeamPage({
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
        <Link href="/">Open your workspace</Link>
      </div>
    );
  const { client, user } = await requireUser();
  const { data: membership, error: membershipError } = await client
    .from("brand_memberships")
    .select("capabilities,active")
    .eq("brand_id", activeBrand.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError)
    throw new Error("Brand permissions could not be loaded.");
  if (
    !membership?.active ||
    !membership.capabilities.includes("workspace.manage")
  )
    return (
      <div className="page-content">
        <h1>Brand access</h1>
        <p>
          Only a brand manager can invite agencies or revoke access to{" "}
          {activeBrand.name}.
        </p>
      </div>
    );
  const params = await searchParams;
  const inviteCursor = readCursor(params, "invite");
  const grantCursor = readCursor(params, "grant");
  let invites = client
    .from("brand_invitations")
    .select("*")
    .eq("brand_id", activeBrand.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(51);
  let grants = client
    .from("brand_access_grants")
    .select("*")
    .eq("brand_id", activeBrand.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(51);
  if (inviteCursor) invites = invites.or(cursorFilter(inviteCursor));
  if (grantCursor) grants = grants.or(cursorFilter(grantCursor));
  const [invitationResult, grantResult] = await Promise.all([invites, grants]);
  if (invitationResult.error || grantResult.error)
    throw new Error("Brand access could not be loaded.");
  const invitationRows = invitationResult.data.slice(0, 50),
    grantRows = grantResult.data.slice(0, 50);
  const lastInvite = invitationRows.at(-1),
    lastGrant = grantRows.at(-1);
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="PARTNERS, WITH PERMISSION"
        title="Brand access."
        accent={activeBrand.name}
        description="Invite an agency to this brand and control its access independently of ownership."
      />
      <section className="panel onboarding-panel">
        <InvitationForm
          brandId={activeBrand.id}
          brandName={activeBrand.name}
          requestId={randomUUID()}
        />
      </section>
      <section className="panel onboarding-panel">
        <h2>Agency access</h2>
        {grantRows.length === 0 ? (
          <p>No agency access on this page.</p>
        ) : (
          grantRows.map((row) => (
            <article key={row.id}>
              <p>
                Agency <code>{row.agency_organization_id}</code>
              </p>
              <p>
                {accessLabel(row.access_level)} ·{" "}
                {row.active ? "Active" : "Revoked"}
              </p>
              {row.active ? (
                <AgencyCapabilitiesForm
                  key={row.permission_version}
                  brandId={activeBrand.id}
                  brandName={activeBrand.name}
                  grant={row}
                />
              ) : null}
              {row.active ? (
                <RevokeAccessForm
                  brandId={activeBrand.id}
                  brandName={activeBrand.name}
                  grantId={row.id}
                  agencyId={row.agency_organization_id}
                />
              ) : null}
            </article>
          ))
        )}
        {grantResult.data.length > 50 && lastGrant ? (
          <Link href={nextPage("/team", lastGrant, "grant")}>Older grants</Link>
        ) : null}
      </section>
      <section className="panel onboarding-panel">
        <h2>Invitations</h2>
        {invitationRows.length === 0 ? (
          <p>No invitations on this page.</p>
        ) : (
          invitationRows.map((row) => (
            <article key={row.id}>
              <h3>{row.recipient_email}</h3>
              <p>
                {accessLabel(row.access_level)} · {row.state}
              </p>
              <p>Expires {new Date(row.expires_at).toISOString()} (UTC)</p>
              {row.state === "pending" ? (
                <CancelInvitationForm
                  brandId={activeBrand.id}
                  invitationId={row.id}
                />
              ) : null}
            </article>
          ))
        )}
        {invitationResult.data.length > 50 && lastInvite ? (
          <Link href={nextPage("/team", lastInvite, "invite")}>
            Older invitations
          </Link>
        ) : null}
      </section>
    </div>
  );
}
