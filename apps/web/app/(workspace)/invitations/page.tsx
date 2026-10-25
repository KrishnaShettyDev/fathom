import Link from "next/link";
import { AcceptInvitationForm } from "../../../components/agency/forms";
import { PageHeading } from "../../../components/shared";
import { requireUser } from "../../../lib/auth/session";
import {
  accessLabel,
  cursorFilter,
  getAgencies,
  nextPage,
  readCursor,
  type PageParams,
} from "../../../lib/agency/queries";
export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<PageParams>;
}) {
  const { client, user } = await requireUser();
  const cursor = readCursor(await searchParams);
  let query = client
    .from("brand_invitations")
    .select("*")
    .eq("recipient_email", user.email?.toLowerCase() ?? "")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(51);
  if (cursor) query = query.or(cursorFilter(cursor));
  const [{ data, error }, agencies] = await Promise.all([query, getAgencies()]);
  if (error) throw new Error("Invitations could not be loaded.");
  const rows = data.slice(0, 50);
  const last = rows.at(-1);
  return (
    <div className="page-content">
      <p>
        <Link href="/claims">Review brand ownership requests</Link>
      </p>
      <Link href="/staff-invitations">View agency staff invitations</Link>
      <PageHeading
        eyebrow="SHARED WORK, CLEAR ACCESS"
        title="Your invitations."
        accent="Your choice."
        description={`Invitations addressed to ${user.email}. Accept for an agency you administer. Expiry and current permissions are checked on acceptance.`}
      />
      {rows.length === 0 ? (
        <section className="panel onboarding-panel">
          <p>No invitations on this page.</p>
        </section>
      ) : (
        rows.map((row) => {
          const available = row.state === "pending";
          return (
            <section key={row.id} className="panel onboarding-panel">
              <h2>{row.brand_name}</h2>
              <p>
                {accessLabel(row.access_level)} · {row.state}
              </p>
              <p>Expires {new Date(row.expires_at).toISOString()} (UTC)</p>
              {available ? (
                agencies.length ? (
                  <AcceptInvitationForm
                    invitationId={row.id}
                    agencies={agencies}
                  />
                ) : (
                  <Link className="button primary" href="/agency">
                    Create an agency to accept
                  </Link>
                )
              ) : null}
            </section>
          );
        })
      )}
      {data.length > 50 && last ? (
        <Link href={nextPage("/invitations", last)}>Older invitations</Link>
      ) : null}
    </div>
  );
}
