import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getWorkspaceContext } from "../../../lib/workspaces/context";
import { requireUser } from "../../../lib/auth/session";
import { PageHeading } from "../../../components/shared";
import type { PageParams } from "../../../lib/agency/queries";
const values = z.record(z.string(), z.union([z.string(), z.number()]));
const metadata = z.object({
  subjectToThresholding: z.boolean().optional(),
  dataLossFromOtherRow: z.boolean().optional(),
  samplingMetadatas: z.array(z.unknown()).optional(),
});
export default async function AnalyticsPage({
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
  const params = await searchParams;
  const selected =
    params.source === undefined ? null : z.uuid().safeParse(params.source);
  if (selected && !selected.success) notFound();
  const { client } = await requireUser();
  const { data: sources, error } = await client
    .from("brand_sources")
    .select(
      "id,provider,account_label,verified_account,state,provider_timezone,last_success_at",
    )
    .eq("brand_id", activeBrand.id)
    .in("provider", ["gsc", "ga4"])
    .order("created_at")
    .limit(100);
  if (error) throw new Error("Analytics sources could not be loaded.");
  const source = selected?.success
    ? sources.find((s) => s.id === selected.data)
    : undefined;
  if (selected && !source) notFound();
  const days = source
    ? await client
        .from("analytics_days")
        .select("*")
        .eq("brand_id", activeBrand.id)
        .eq("source_id", source.id)
        .order("observed_date", { ascending: false })
        .limit(31)
    : null;
  if (days?.error) throw new Error("Daily metrics could not be loaded.");
  return (
    <div className="page-content">
      <PageHeading
        eyebrow={activeBrand.name}
        title="Search and outcomes."
        accent="With their limits."
        description="Choose an exact property. Metrics retain provider dates, timezone, freshness and missingness; properties are never silently combined."
      />
      <section className="panel onboarding-panel">
        <h2>Properties</h2>
        {sources.length ? (
          sources.map((s) => (
            <p key={s.id}>
              <Link href={`/analytics?source=${s.id}`}>{s.account_label}</Link>{" "}
              · {s.provider} · {s.state.replaceAll("_", " ")}
            </p>
          ))
        ) : (
          <p>
            No Google properties saved.{" "}
            <Link href="/connections">Review connections</Link>
          </p>
        )}
      </section>
      {source ? (
        <>
          <section className="panel onboarding-panel">
            <h2>{source.account_label}</h2>
            <p>
              {source.verified_account ?? "Property unverified"} ·{" "}
              {source.provider_timezone ?? "Timezone unavailable"}
            </p>
            <p>
              Last successful collection: {source.last_success_at ?? "Never"}.
              Source state: {source.state}.
            </p>
            <p>
              Collection requests cover 28 dates ending three days before the
              request. Missing rows remain unavailable; provider corrections can
              change a later collection.
            </p>
            <p>
              {source.provider === "gsc"
                ? "Search Console: web-search clicks, impressions, CTR (clicks ÷ impressions) and average position. Provider dates use America/Los_Angeles. Search Console may omit data; these are provider-reported aggregates."
                : "GA4: sessions, daily total users and key events as recorded by the property. Daily users are not additive across dates. Thresholding, consent and tracking affect coverage; key events are not confirmed orders."}
            </p>
          </section>
          <section className="panel onboarding-panel">
            <h2>Latest 31 recorded dates</h2>
            {days?.data.length ? (
              days.data.map((day) => {
                const flags = metadata.parse(day.metadata);
                return (
                  <article key={day.id}>
                    <h3>
                      {day.observed_date} · {day.provider_timezone}
                    </h3>
                    {day.metrics === null ? (
                      <p>
                        Unavailable: the provider returned no row for this date.
                      </p>
                    ) : (
                      <dl>
                        {Object.entries(values.parse(day.metrics)).map(
                          ([name, value]) => (
                            <div key={name}>
                              <dt>{name}</dt>
                              <dd>{value}</dd>
                            </div>
                          ),
                        )}
                      </dl>
                    )}
                    {flags.subjectToThresholding ||
                    flags.dataLossFromOtherRow ||
                    flags.samplingMetadatas?.length ? (
                      <p className="notice">
                        Provider reported thresholding, grouping loss or
                        sampling. Treat these measurements as limited coverage.
                      </p>
                    ) : null}
                    <p>Captured {day.captured_at}</p>
                  </article>
                );
              })
            ) : (
              <p>
                No measurement dates collected. This is unavailable data, not
                zero activity.
              </p>
            )}
          </section>
        </>
      ) : (
        <section className="panel onboarding-panel">
          <p>Select a property to inspect its daily measurements.</p>
        </section>
      )}
    </div>
  );
}
