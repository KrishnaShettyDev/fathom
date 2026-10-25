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
        </section>
      </div>
    );
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="YOUR BRAND, IN PERSPECTIVE"
        title="See clearly."
        accent="Build on real evidence."
        description={`${activeBrand.name} has a workspace. Connect a source to build your first baseline.`}
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
        <span className="tag">Saved workspace</span>
      </section>
      <section className="empty-state">
        <div className="empty-art">
          <Icon name="signal" size={38} />
        </div>
        <span className="eyebrow">YOUR FIRST BASELINE</span>
        <h2>The picture starts with your sources.</h2>
        <p>
          Products, visibility, opportunities, and reports will appear when real
          data has been connected and processed. No measurements are available
          yet.
        </p>
        <Link href="/connections" className="button primary">
          Review source setup
          <Icon name="arrow" />
        </Link>
        <small>
          Shopify catalogue connection is the next implementation step.
        </small>
      </section>
    </div>
  );
}
