import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "../../../../../lib/auth/session";
import { PageHeading } from "../../../../../components/shared";
import {
  InviteStaffForm,
  StaffAction,
} from "../../../../../components/agency/staff-forms";
export default async function AgencyStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { client, user } = await requireUser();
  const agency = await client
    .from("agency_organizations")
    .select("organization_id,organizations!inner(name)")
    .eq("organization_id", id)
    .maybeSingle();
  if (agency.error) throw new Error("Agency could not be loaded.");
  if (!agency.data) notFound();
  const [members, invites] = await Promise.all([
    client.rpc("list_agency_staff", { agency: id }),
    client
      .from("agency_staff_invitations")
      .select("*")
      .eq("agency_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (members.error || invites.error)
    throw new Error("Staff access could not be loaded.");
  return (
    <div className="page-content">
      <Link href="/agency">← Agencies</Link>
      <PageHeading
        eyebrow={agency.data.organizations.name}
        title="Agency staff."
        accent="Current access."
        description="Staff inherit only the permissions each brand grants to this agency. Staff cannot administer the agency."
      />
      <section className="panel onboarding-panel">
        <InviteStaffForm agency={id} name={agency.data.organizations.name} />
      </section>
      <section className="panel onboarding-panel">
        <h2>Members (up to 100)</h2>
        {members.data.map((member) => (
          <article key={member.user_id}>
            <h3>{member.email}</h3>
            <p>{member.active ? "Active" : "Revoked"}</p>
            {member.active && member.user_id !== user.id ? (
              <StaffAction
                operation="revoke"
                id={member.user_id}
                agency={id}
                label={member.email}
              />
            ) : null}
          </article>
        ))}
      </section>
      <section className="panel onboarding-panel">
        <h2>Latest 50 invitations</h2>
        {invites.data.map((invite) => (
          <article key={invite.id}>
            <h3>{invite.recipient_email}</h3>
            <p>
              {invite.state} · expires {invite.expires_at}
            </p>
            {invite.state === "pending" ? (
              <StaffAction
                operation="cancel"
                id={invite.id}
                agency={id}
                label={invite.recipient_email}
              />
            ) : null}
          </article>
        ))}
        {!invites.data.length ? <p>No invitations saved.</p> : null}
      </section>
    </div>
  );
}
