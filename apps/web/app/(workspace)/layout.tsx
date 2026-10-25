import type { ReactNode } from "react";
import { WorkspaceShell } from "../../components/workspace-shell";
import { getWorkspaceContext } from "../../lib/workspaces/context";
import { clearWorkspaceSelection } from "../../lib/workspaces/actions";
export const dynamic = "force-dynamic";
export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const context = await getWorkspaceContext();
  return (
    <WorkspaceShell
      brands={context.brands}
      activeBrand={context.activeBrand}
      email={context.email}
    >
      {context.selectionDenied ? (
        <div className="page-content">
          <section className="empty-state">
            <h1>Workspace unavailable.</h1>
            <p>
              Your access may have changed. Select one of your current
              workspaces to continue.
            </p>
            <form action={clearWorkspaceSelection}>
              <button className="button primary">
                Return to my workspaces
              </button>
            </form>
          </section>
        </div>
      ) : (
        children
      )}
    </WorkspaceShell>
  );
}
