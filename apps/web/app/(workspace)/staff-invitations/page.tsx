import Link from "next/link";
import { requireUser } from "../../../lib/auth/session";
import { StaffAction } from "../../../components/agency/staff-forms";
import { PageHeading } from "../../../components/shared";
export default async function StaffInvitationsPage() {
  const { client, user } = await requireUser();
  const { data, error } = await client
    .from("agency_staff_invitations")
    .select("*")
    .eq("recipient_email", user.email?.toLowerCase() ?? "")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error("Staff invitations could not be loaded.");
  return (
    <div className="page-content">
      <Link href="/invitations">← Brand invitations</Link>
      <PageHeading
        eyebrow="AGENCY MEMBERSHIP"
        title="Staff invitations."
        accent="Your choice."
        description="Accept only an agency you intend to join. Membership receives that agency’s current client permissions."
      />
      {data.map((invite) => (
        <section className="panel onboarding-panel" key={invite.id}>
          <h2>Agency {invite.agency_id}</h2>
          <p>
            {invite.state} · Expires {invite.expires_at}
          </p>
          {invite.state === "pending" ? (
            <StaffAction
              operation="accept"
              id={invite.id}
              label={invite.agency_id}
            />
          ) : null}
        </section>
      ))}
      {!data.length ? <p>No staff invitations.</p> : null}
    </div>
  );
}
