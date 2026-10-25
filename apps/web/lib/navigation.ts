export const sections = [
  { id: "overview", label: "Overview", icon: "overview" },
  { id: "visibility", label: "AI visibility", icon: "signal" },
  { id: "opportunities", label: "Opportunities", icon: "spark" },
  { id: "analytics", label: "Search & analytics", icon: "report" },
  { id: "catalogue", label: "Catalogue", icon: "box" },
  { id: "knowledge", label: "Brand knowledge", icon: "book" },
  { id: "audit", label: "Website audit", icon: "globe" },
  { id: "reports", label: "Reports", icon: "report" },
  { id: "connections", label: "Connections", icon: "link" },
  { id: "settings", label: "Settings & baseline", icon: "book" },
  { id: "support", label: "Support access", icon: "link" },
  { id: "team", label: "Brand access", icon: "link" },
  { id: "invitations", label: "Invitations", icon: "report" },
  { id: "agency", label: "Your agency", icon: "book" },
] as const;
export type Section = (typeof sections)[number]["id"];
