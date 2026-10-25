export const sections = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "visibility", label: "AI visibility", icon: "signal" },
  { id: "opportunities", label: "Opportunities", icon: "spark" },
  { id: "catalogue", label: "Catalogue", icon: "box" },
  { id: "knowledge", label: "Brand knowledge", icon: "book" },
  { id: "audit", label: "Website audit", icon: "globe" },
  { id: "reports", label: "Reports", icon: "report" },
  { id: "connections", label: "Connections", icon: "link" },
] as const;
export type Section = (typeof sections)[number]["id"];
