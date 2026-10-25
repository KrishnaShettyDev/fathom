import { z } from "zod";
import {
  sha256,
  shopSchema,
  transaction,
  verifyWebhook,
} from "@fathom/connectors";
const topics = new Set([
  "products/create",
  "products/update",
  "products/delete",
  "app/uninstalled",
  "app/scopes_update",
]);
export async function POST(request: Request) {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!secret || !process.env.DATABASE_URL)
    return new Response("Webhook configuration pending", { status: 503 });
  const shop = shopSchema.safeParse(
    request.headers.get("x-shopify-shop-domain"),
  );
  const topic = request.headers.get("x-shopify-topic");
  const delivery = z
    .uuid()
    .safeParse(request.headers.get("x-shopify-webhook-id"));
  const signature = request.headers.get("x-shopify-hmac-sha256");
  if (
    !shop.success ||
    !topic ||
    !topics.has(topic) ||
    !delivery.success ||
    !signature
  )
    return new Response("Invalid webhook metadata", { status: 400 });
  const reader = request.body?.getReader();
  if (!reader) return new Response("Body required", { status: 400 });
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 1_000_000)
        return new Response("Payload too large", { status: 413 });
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  const raw = Buffer.concat(chunks);
  if (!verifyWebhook(raw, signature, secret))
    return new Response("Invalid signature", { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(raw.toString("utf8"));
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (topic === "app/uninstalled") {
    const body = z.object({ myshopify_domain: shopSchema }).safeParse(payload);
    if (!body.success || body.data.myshopify_domain !== shop.data)
      return new Response("Shop mismatch", { status: 400 });
  }
  try {
    await transaction(async (db) => {
      const receipt = await db.query(
        "insert into private.webhook_receipts(delivery_id,shop,topic,payload_hash) values($1,$2,$3,$4) on conflict do nothing returning delivery_id",
        [delivery.data, shop.data, topic, sha256(raw)],
      );
      if (!receipt.rowCount) return;
      const sources = await db.query<{
        id: string;
        brand_id: string;
        updated_by: string;
      }>(
        "select id,brand_id,updated_by from public.brand_sources where provider='shopify' and verified_account=$1 and state in ('authorized','degraded') for update",
        [shop.data],
      );
      for (const source of sources.rows) {
        if (topic === "app/uninstalled")
          await db.query(
            "update public.brand_sources set state='disabled',version=version+1,updated_at=now(),error_code='APP_UNINSTALLED' where id=$1",
            [source.id],
          );
        else if (topic === "app/scopes_update") {
          await db.query(
            "update public.brand_sources set state='degraded',version=version+1,error_code='SCOPES_CHANGED',updated_at=now() where id=$1",
            [source.id],
          );
          await db.query(
            "update public.collection_runs set state='cancelled',error_code='SCOPES_CHANGED',completed_at=now() where source_id=$1 and state in ('queued','running')",
            [source.id],
          );
        } else {
          await db.query(
            "update public.brand_sources set reconciliation_requested_at=now() where id=$1",
            [source.id],
          );
          if (topic === "products/delete") {
            const body = z
              .object({
                id: z.union([
                  z.string().regex(/^\d+$/),
                  z.number().int().safe(),
                ]),
              })
              .safeParse(payload);
            if (!body.success) throw new Error("INVALID_PRODUCT_ID");
            const id = `gid://shopify/Product/${body.data.id}`;
            await db.query(
              "update public.catalogue_records set removed_at=now() where source_id=$1 and (external_id=$2 or payload->'product'->>'id'=$2) and removed_at is null",
              [source.id, id],
            );
          }
        }
        await db.query(
          "insert into audit.events(brand_id,actor_id,event_type,details) values($1,$2,'source.webhook_received',jsonb_build_object('source_id',$3::uuid,'topic',$4::text,'delivery_id',$5::text,'actor_kind','provider'))",
          [source.brand_id, source.updated_by, source.id, topic, delivery.data],
        );
      }
    });
    return new Response(null, { status: 204 });
  } catch {
    return new Response("Webhook receipt could not be persisted", {
      status: 503,
    });
  }
}
