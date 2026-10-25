import { randomUUID } from "node:crypto";
import {
  AuthorizeGoogleForm,
  AuthorizeShopifyForm,
  SyncSourceForm,
  AllowanceForm,
} from "../../../components/connector-controls";
import {
  shopifyConfiguration,
  googleConfiguration,
} from "../../../lib/connectors/config";
import { requireUser } from "../../../lib/auth/session";

import { hasBrandCapability } from "../../../lib/workspaces/permissions";
import Link from "next/link";
import { getWorkspaceContext } from "../../../lib/workspaces/context";
import { getSources } from "../../../lib/sources/queries";
import { providers } from "../../../lib/sources/validation";
import { nextPage, type PageParams } from "../../../lib/agency/queries";
import { PageHeading } from "../../../components/shared";
import {
  RegisterSourceForm,
  SourceStateForm,
} from "../../../components/source-forms";
export default async function ConnectionsPage({
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
  const { rows, hasMore, canConnect } = await getSources(
    activeBrand.id,
    await searchParams,
  );
  const last = rows.at(-1);
  const { client } = await requireUser();
  const [allowance, runs, canManage] = await Promise.all([
    client
      .from("collection_allowances")
      .select("monthly_run_limit")
      .eq("brand_id", activeBrand.id)
      .maybeSingle(),
    client
      .from("collection_runs")
      .select("id,state,phase,pages,records,error_code,created_at,source_id")
      .eq("brand_id", activeBrand.id)
      .order("created_at", { ascending: false })
      .limit(10),
    hasBrandCapability(activeBrand.id),
  ]);
  if (allowance.error || runs.error)
    throw new Error("Collection status could not be loaded.");
  const configured = !!shopifyConfiguration();
  const googleConfigured = !!googleConfiguration();

  return (
    <div className="page-content">
      <PageHeading
        eyebrow={activeBrand.name}
        title="Your sources."
        accent="A clear starting point."
        description="Authorize exact Shopify and Google accounts, queue collection and inspect source health."
      />
      <section className="connection-banner">
        <div>
          <h2>Your accounts. Your control.</h2>
          <p>
            Saved references are unverified until authorization. Shopify
            credentials stay encrypted on the server; saving a reference does
            not connect an account.
          </p>
        </div>
      </section>
      {canConnect ? (
        <section className="panel onboarding-panel">
          <details>
            <summary>Add a source account</summary>
            <RegisterSourceForm brandId={activeBrand.id} />
          </details>
        </section>
      ) : (
        <p>Read-only access. A connection operator can manage source setup.</p>
      )}
      <div className="connections-grid">
        {rows.length ? (
          rows.map((source) => (
            <article key={source.id} className="connection-card">
              <span className="eyebrow">
                {Object.entries(providers).find(
                  ([key]) => key === source.provider,
                )?.[1] ?? source.provider}
              </span>
              <h2>{source.account_label}</h2>
              <p className="source-reference">{source.account_reference}</p>
              <span className="tag">{source.state.replaceAll("_", " ")}</span>
              <dl>
                <dt>Account verification</dt>
                <dd>{source.verified_account ?? "Not verified"}</dd>
                <dt>Granted capabilities</dt>
                <dd>{source.granted_scopes.join(", ") || "None verified"}</dd>
                <dt>Last successful sync</dt>
                <dd>{source.last_success_at ?? "Never synced"}</dd>
                <dt>Next step</dt>
                <dd>
                  {source.state === "disabled"
                    ? "Resume setup when ready."
                    : source.state === "authorized"
                      ? "Queue a source sync."
                      : "Complete provider authorization."}
                </dd>
              </dl>
              {source.error_code ? (
                <p className="notice">
                  {source.error_code.replaceAll("_", " ")}
                </p>
              ) : null}
              {canConnect && source.provider === "shopify" ? (
                source.state === "authorized" ? (
                  <SyncSourceForm
                    brandId={activeBrand.id}
                    sourceId={source.id}
                    requestId={randomUUID()}
                  />
                ) : (
                  <AuthorizeShopifyForm
                    brandId={activeBrand.id}
                    brandName={activeBrand.name}
                    sourceId={source.id}
                    shop={source.account_reference}
                    configured={configured}
                  />
                )
              ) : null}
              {canConnect &&
              (source.provider === "gsc" || source.provider === "ga4") ? (
                source.state === "authorized" ? (
                  <SyncSourceForm
                    brandId={activeBrand.id}
                    sourceId={source.id}
                    requestId={randomUUID()}
                  />
                ) : (
                  <AuthorizeGoogleForm
                    brandId={activeBrand.id}
                    brandName={activeBrand.name}
                    sourceId={source.id}
                    reference={source.account_reference}
                    configured={googleConfigured}
                  />
                )
              ) : null}
              {canConnect ? (
                <SourceStateForm
                  key={source.version}
                  source={source}
                  brandName={activeBrand.name}
                />
              ) : null}
            </article>
          ))
        ) : (
          <section className="panel onboarding-panel">
            <h2>No source accounts saved.</h2>
            <p>
              Add your real account reference to prepare setup. No sample
              accounts or measurements are shown.
            </p>
          </section>
        )}
      </div>
      {hasMore && last ? (
        <Link href={nextPage("/connections", last)}>Older accounts</Link>
      ) : null}
      <section className="panel onboarding-panel">
        <h2>Latest 10 collection runs</h2>
        {runs.data.length ? (
          runs.data.map((run) => (
            <p key={run.id}>
              {run.created_at} · {run.state} · {run.phase} · {run.pages} pages ·{" "}
              {run.records} records processed
              {run.error_code ? ` · ${run.error_code}` : ""}
            </p>
          ))
        ) : (
          <p>No collection has been requested.</p>
        )}
        <Link href="/catalogue">Inspect catalogue</Link> ·{" "}
        <Link href="/analytics">Inspect analytics</Link>
      </section>
      {canManage ? (
        <section className="panel onboarding-panel">
          <AllowanceForm
            brandId={activeBrand.id}
            limit={allowance.data?.monthly_run_limit ?? 20}
          />
        </section>
      ) : null}
      <section className="panel onboarding-panel">
        <h2>AI observations</h2>
        <p>
          Provider selection, permitted collection method and budget are still
          required. No observations have been collected.
        </p>
      </section>
    </div>
  );
}
