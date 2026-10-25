import { notFound, redirect } from "next/navigation";
import { getWorkspaceContext } from "../../../lib/workspaces/context";
import { EmptyState, PageHeading } from "../../../components/shared";
import { ConnectionsView } from "../../../components/connections-view";
const views = {
  visibility: {
    title: "Your presence.",
    accent: "Measured with evidence.",
    description:
      "Visibility is unavailable until observations are collected from a permitted provider.",
    empty: "No observations collected.",
    icon: "signal",
  },
  opportunities: {
    title: "Find the gap.",
    accent: "Start with evidence.",
    description: "Recommendations will be grounded in connected source data.",
    empty: "No evidence-backed opportunities yet.",
    icon: "spark",
  },
  catalogue: {
    title: "Your products.",
    accent: "The whole picture.",
    description:
      "Your actual products and their availability will come from a connected store.",
    empty: "No catalogue source connected.",
    icon: "box",
  },
  knowledge: {
    title: "Your brand.",
    accent: "Grounded in facts.",
    description: "Approved facts need a source, owner, and review history.",
    empty: "No brand facts recorded.",
    icon: "book",
  },
  audit: {
    title: "A stronger foundation.",
    accent: "One page at a time.",
    description:
      "Findings will include affected URLs and reproduction evidence from a real crawl.",
    empty: "No website audit has run.",
    icon: "globe",
  },
  reports: {
    title: "Your story.",
    accent: "Backed by real data.",
    description:
      "Reports become available after source data and a baseline are reviewed.",
    empty: "No report is available yet.",
    icon: "report",
  },
} as const;
export default async function SectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const { activeBrand, selectionDenied } = await getWorkspaceContext();
  if (selectionDenied) return null;
  if (!activeBrand) redirect("/");
  if (section === "connections")
    return <ConnectionsView brandName={activeBrand.name} />;
  if (!(section in views)) notFound();
  const view = Object.entries(views).find(([key]) => key === section)?.[1];
  if (!view) notFound();
  return (
    <div className="page-content">
      <PageHeading
        eyebrow={activeBrand.name}
        title={view.title}
        accent={view.accent}
        description={view.description}
      />
      <EmptyState
        title={view.empty}
        description="Source collection is not enabled yet. No data has been inferred, generated, or substituted."
        icon={view.icon}
      />
    </div>
  );
}
