import Link from "next/link";
import { getWorkspaceContext } from "../../../lib/workspaces/context";
import { requireUser } from "../../../lib/auth/session";

import { hasBrandCapability } from "../../../lib/workspaces/permissions";
import { PageHeading } from "../../../components/shared";
import {
  SupportForm,
  RevokeSupportForm,
} from "../../../components/agency/support-forms";
import {
  readCursor,
  cursorFilter,
  nextPage,
  type PageParams,
} from "../../../lib/agency/queries";
export default async function SupportPage({
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
  const { client } = await requireUser();
  const cursor = readCursor(await searchParams);
  let query = client
    .from("support_sessions")
    .select("*")
    .eq("brand_id", activeBrand.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(26);
  if (cursor) query = query.or(cursorFilter(cursor));
  const [sessions, canManage] = await Promise.all([
    query,
    hasBrandCapability(activeBrand.id),
  ]);
  if (sessions.error) throw new Error("Support sessions could not be loaded.");
  const rows = sessions.data.slice(0, 25);
  const last = rows.at(-1);
  return (
    <div className="page-content">
      <PageHeading
        eyebrow={activeBrand.name}
        title="Temporary support."
        accent="Explicit boundaries."
        description="A named owner, a specific purpose and a fixed expiry. Read and connector access only; ownership remains with the brand."
      />
      {canManage ? (
        <section className="panel onboarding-panel">
          <SupportForm brandId={activeBrand.id} brandName={activeBrand.name} />
        </section>
      ) : null}
      <section className="panel onboarding-panel">
        <h2>Support sessions</h2>
        {rows.map((session) => {
          const revocable = !session.revoked_at;
          return (
            <article key={session.id}>
              <h3>{session.purpose}</h3>
              <p>
                Operator: {session.operator_id} · Owner: {session.owner_id}
              </p>
              <p>
                {session.access_level} ·{" "}
                {session.revoked_at
                  ? "Revoked"
                  : "Access ends at the expiry below"}
              </p>
              <p>
                Created {session.created_at} · Expires {session.expires_at}
              </p>
              {canManage && revocable ? (
                <RevokeSupportForm
                  brandId={activeBrand.id}
                  sessionId={session.id}
                />
              ) : null}
            </article>
          );
        })}
        {!rows.length ? <p>No visible support sessions.</p> : null}
        {sessions.data.length > 25 && last ? (
          <Link href={nextPage("/support", last)}>Older sessions</Link>
        ) : null}
      </section>
    </div>
  );
}
