import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
export const SHOPIFY_API_VERSION = "2026-07";
export const shopSchema = z
  .string()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/)
  .max(253);
export const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().positive(),
  scope: z.string(),
  refresh_token_expires_in: z.number().positive().optional(),
});
export type ShopifyToken = z.infer<typeof tokenSchema>;
export class ProviderError extends Error {
  constructor(
    public readonly code: string,
    public readonly retryAfterSeconds = 0,
  ) {
    super(code);
    this.name = "ProviderError";
  }
}
export async function boundedJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    const retry = Number(response.headers.get("retry-after"));
    throw new ProviderError(
      response.status === 429
        ? "PROVIDER_THROTTLED"
        : response.status === 401 || response.status === 403
          ? "AUTHORIZATION_EXPIRED"
          : "PROVIDER_UNAVAILABLE",
      Number.isFinite(retry) ? Math.min(Math.max(retry, 0), 300) : 0,
    );
  }
  const reader = response.body?.getReader();
  if (!reader) throw new ProviderError("EMPTY_RESPONSE");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 5_000_000) throw new ProviderError("RESPONSE_TOO_LARGE");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ProviderError("INVALID_RESPONSE");
  }
}
export function verifyCallback(
  params: URLSearchParams,
  secret: string,
): boolean {
  const hmac = params.get("hmac");
  if (!hmac || !/^[a-f0-9]{64}$/i.test(hmac)) return false;
  if (
    [...new Set(params.keys())].some((key) => params.getAll(key).length !== 1)
  )
    return false;
  const sorted = new URLSearchParams(params);
  sorted.delete("hmac");
  sorted.sort();
  const message = [...sorted.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  const expected = createHmac("sha256", secret).update(message).digest();
  return timingSafeEqual(expected, Buffer.from(hmac, "hex"));
}
export function verifyWebhook(
  body: Buffer,
  signature: string,
  secret: string,
): boolean {
  const supplied = Buffer.from(signature, "base64");
  const expected = createHmac("sha256", secret).update(body).digest();
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}
export async function exchangeToken(
  shop: string,
  fields: Record<string, string>,
  previousScopes?: string,
): Promise<ShopifyToken> {
  const host = shopSchema.parse(shop);
  const response = await fetch(`https://${host}/admin/oauth/access_token`, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(20000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(fields),
  });
  const raw = tokenSchema
    .extend({ scope: z.string().optional() })
    .parse(await boundedJson(response));
  const token = tokenSchema.parse({
    ...raw,
    scope: raw.scope ?? previousScopes ?? "",
  });
  const scopes = token.scope.split(",");
  if (!scopes.includes("read_products") && !scopes.includes("write_products"))
    throw new ProviderError("MISSING_PRODUCT_SCOPE");
  return token;
}
export const queries = {
  products:
    "query CatalogueProducts($after: String) { shop { currencyCode } products(first: 50, after: $after, sortKey: ID) { nodes { id title status updatedAt descriptionHtml } pageInfo { hasNextPage endCursor } } }",
  variants:
    "query CatalogueVariants($after: String) { shop { currencyCode } productVariants(first: 50, after: $after, sortKey: ID) { nodes { id title product { id } price inventoryQuantity } pageInfo { hasNextPage endCursor } } }",
  collections:
    "query CatalogueCollections($after: String) { shop { currencyCode } collections(first: 50, after: $after, sortKey: ID) { nodes { id title handle updatedAt descriptionHtml } pageInfo { hasNextPage endCursor } } }",
} as const;
const pageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().nullable(),
});
const product = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  updatedAt: z.string(),
  descriptionHtml: z.string(),
});
const variant = z.object({
  id: z.string(),
  title: z.string(),
  product: z.object({ id: z.string() }),
  price: z.string().regex(/^\d+(\.\d+)?$/),
  inventoryQuantity: z.number().int().nullable(),
});
const collection = z.object({
  id: z.string(),
  title: z.string(),
  handle: z.string(),
  updatedAt: z.string(),
  descriptionHtml: z.string(),
});
const responseSchema = z.object({
  data: z
    .object({
      shop: z.object({ currencyCode: z.string() }),
      products: z
        .object({ nodes: z.array(product), pageInfo: pageInfoSchema })
        .optional(),
      productVariants: z
        .object({ nodes: z.array(variant), pageInfo: pageInfoSchema })
        .optional(),
      collections: z
        .object({ nodes: z.array(collection), pageInfo: pageInfoSchema })
        .optional(),
    })
    .optional(),
  errors: z
    .array(
      z.object({
        extensions: z.object({ code: z.string().optional() }).optional(),
      }),
    )
    .optional(),
});
export async function cataloguePage(
  shop: string,
  token: string,
  phase: keyof typeof queries,
  cursor: string | null,
) {
  const host = shopSchema.parse(shop);
  const response = await fetch(
    `https://${host}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`,
    {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(20000),
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
      },
      body: JSON.stringify({
        query: queries[phase],
        variables: { after: cursor },
      }),
    },
  );
  const value = responseSchema.parse(await boundedJson(response));
  if (value.errors?.length)
    throw new ProviderError(
      value.errors.some((e) => e.extensions?.code === "THROTTLED")
        ? "PROVIDER_THROTTLED"
        : "PROVIDER_QUERY_FAILED",
      2,
    );
  const data = value.data;
  if (!data) throw new ProviderError("INVALID_RESPONSE");
  const page =
    phase === "products"
      ? data.products
      : phase === "variants"
        ? data.productVariants
        : data.collections;
  if (!page) throw new ProviderError("INVALID_RESPONSE");
  if (
    page.pageInfo.hasNextPage &&
    (!page.pageInfo.endCursor || page.pageInfo.endCursor === cursor)
  )
    throw new ProviderError("PAGINATION_STALLED");
  return {
    nodes: page.nodes,
    currency: data.shop.currencyCode,
    pageInfo: page.pageInfo,
  };
}
