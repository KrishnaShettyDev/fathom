import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireUser } from "../../../lib/auth/session";
import { getWorkspaceContext } from "../../../lib/workspaces/context";
import { PageHeading } from "../../../components/shared";
import type { PageParams } from "../../../lib/agency/queries";
const payloadSchema = z.object({
  price: z.string().optional(),
  currency: z.string().optional(),
  inventoryQuantity: z.number().nullable().optional(),
  status: z.string().optional(),
  descriptionHtml: z.string().optional(),
  product: z.object({ id: z.string() }).optional(),
});
export default async function CataloguePage({
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
  const kind = z
    .enum(["product", "variant", "collection"])
    .safeParse(params.kind ?? "product");
  const cursor =
    params.after === undefined ? null : z.uuid().safeParse(params.after);
  if (!kind.success || (cursor && !cursor.success)) notFound();
  const { client } = await requireUser();
  let query = client
    .from("catalogue_records")
    .select("*")
    .eq("brand_id", activeBrand.id)
    .eq("kind", kind.data)
    .order("id")
    .limit(26);
  if (cursor?.success) query = query.gt("id", cursor.data);
  const [{ data, error }, sources] = await Promise.all([
    query,
    client
      .from("brand_sources")
      .select("id,account_label,state,last_success_at")
      .eq("brand_id", activeBrand.id)
      .eq("provider", "shopify"),
  ]);
  if (error || sources.error) throw new Error("Catalogue could not be loaded.");
  const rows = data.slice(0, 25);
  const last = rows.at(-1);
  return (
    <div className="page-content">
      <PageHeading
        eyebrow={activeBrand.name}
        title="Your catalogue."
        accent="As observed."
        description="Real Shopify records with collection timestamps. Stored records are historical when a source is disconnected or a sync is incomplete."
      />
      <nav aria-label="Catalogue types">
        {["product", "variant", "collection"].map((value) => (
          <Link
            className="button outline"
            href={`/catalogue?kind=${value}`}
            key={value}
          >
            {value}s
          </Link>
        ))}
      </nav>
      <section className="panel onboarding-panel">
        {sources.data.length ? (
          sources.data.map((source) => (
            <p key={source.id}>
              {source.account_label} · {source.state.replaceAll("_", " ")} ·
              Last complete sync: {source.last_success_at ?? "Never"}
            </p>
          ))
        ) : (
          <p>
            No Shopify source configured.{" "}
            <Link href="/connections">Review connections</Link>
          </p>
        )}
      </section>
      {rows.length ? (
        rows.map((row) => {
          const payload = payloadSchema.parse(row.payload);
          return (
            <article key={row.id} className="panel onboarding-panel">
              <span className="tag">
                {row.removed_at
                  ? "Removed from latest complete catalogue"
                  : "Observed record"}
              </span>
              <h2>{row.title}</h2>
              <p>{row.external_id}</p>
              <p>Observed {row.observed_at}</p>
              {payload.status ? <p>Product status: {payload.status}</p> : null}
              {payload.price !== undefined ? (
                <p>
                  Price: {payload.price} {payload.currency}
                </p>
              ) : null}
              {"inventoryQuantity" in payload ? (
                <p>
                  Inventory quantity:{" "}
                  {payload.inventoryQuantity ?? "Unavailable"}. This is not a
                  guarantee of storefront availability.
                </p>
              ) : null}
              {payload.product ? <p>Product: {payload.product.id}</p> : null}
              {payload.descriptionHtml ? (
                <details>
                  <summary>
                    Imported description (source HTML shown as text)
                  </summary>
                  <pre className="source-description">
                    {payload.descriptionHtml}
                  </pre>
                </details>
              ) : null}
            </article>
          );
        })
      ) : (
        <section className="panel onboarding-panel">
          <h2>No imported {kind.data}s on this page.</h2>
          <p>A completed sync is required to establish catalogue coverage.</p>
        </section>
      )}
      {data.length > 25 && last ? (
        <Link href={`/catalogue?kind=${kind.data}&after=${last.id}`}>
          More records
        </Link>
      ) : null}
    </div>
  );
}
