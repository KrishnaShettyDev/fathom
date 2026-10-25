import { requireUser } from "../../lib/auth/session";
import { randomUUID } from "node:crypto";
import Link from "next/link";
import { getWorkspaceContext } from "../../lib/workspaces/context";
import { OnboardingForm } from "../../components/onboarding-form";
import { PageHeading } from "../../components/shared";
import { Icon } from "../../components/icon";
export default async function OverviewPage() {
  const { activeBrand, selectionDenied } = await getWorkspaceContext();
  if (selectionDenied) return null;
  if (!activeBrand)
    return (
      <div className="page-content">
        <PageHeading
          eyebrow="A FOUNDATION FOR YOUR BRAND"
          title="Your workspace."
          accent="Your starting point."
          description="Create a brand workspace before connecting your store and data sources."
        />
        <section className="panel onboarding-panel">
          <OnboardingForm requestId={randomUUID()} />
          <p>
            Working with clients? <Link href="/agency">Create your agency</Link>{" "}
            or <Link href="/invitations">view invitations</Link>.
          </p>
        </section>
      </div>
    );
  const { client } = await requireUser();
  const results = await Promise.all([
    client
      .from("brand_sources")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", activeBrand.id)
      .eq("state", "authorized"),
    client
      .from("catalogue_records")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", activeBrand.id)
      .is("removed_at", null),
    client
      .from("opportunities")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", activeBrand.id),
    client
      .from("client_reports")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", activeBrand.id),
    client
      .from("baseline_reviews")
      .select("id", { count: "exact", head: true })
      .eq("brand_id", activeBrand.id),
  ]);
  if (results.some((result) => result.error))
    throw new Error("Workspace progress could not be loaded.");
  const items = [
    { label: "Authorized sources", href: "/connections" },
    { label: "Current catalogue records", href: "/catalogue" },
    { label: "Evidence-backed opportunities", href: "/opportunities" },
    { label: "Saved reports", href: "/reports" },
    { label: "Baseline acknowledgements", href: "/settings" },
  ];
  return (
    <div className="page-content">
      <PageHeading
        eyebrow={activeBrand.name}
        title="See clearly."
        accent="Build on real evidence."
        description="Your saved workspace progress. Record counts describe available evidence, not business performance."
      />
      <section className="connection-banner">
        <span className="connection-orbit">
          <Icon name="check" size={25} />
        </span>
        <div>
          <h2>{activeBrand.name}</h2>
          <p>
            {activeBrand.website ?? "Website not provided"} ·{" "}
            {activeBrand.reporting_timezone}
          </p>
        </div>
        <Link href="/settings" className="button">
          Workspace settings
        </Link>
      </section>
      <section className="panel onboarding-panel">
        <h2>Setup and activation</h2>
        {items.map((item, index) => (
          <p key={item.href}>
            <Link href={item.href}>{item.label}</Link>:{" "}
            {results[index]?.count ?? "Unavailable"}
          </p>
        ))}
        <p>
          Connect a source, review the baseline, then accept or assign an
          opportunity supported by approved evidence. Website-only workspaces
          can start with an <Link href="/audit">audit</Link>.
        </p>
        <p>
          Inspect source timestamps and run coverage before drawing conclusions.
          A connected account alone does not establish complete or fresh data.
        </p>
      </section>
    </div>
  );
}
