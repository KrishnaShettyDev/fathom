import "server-only";
import { z } from "zod";
import { credentialKeys } from "@fathom/connectors";
export function shopifyConfiguration() {
  const parsed = z
    .object({
      origin: z.url({ protocol: /^https?$/ }),
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
      database: z.string().min(1),
    })
    .safeParse({
      origin: process.env.APP_ORIGIN,
      clientId: process.env.SHOPIFY_CLIENT_ID,
      clientSecret: process.env.SHOPIFY_CLIENT_SECRET,
      database: process.env.DATABASE_URL,
    });
  if (!parsed.success) return null;
  try {
    credentialKeys();
  } catch {
    return null;
  }
  const origin = new URL(parsed.data.origin);
  if (
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password
  )
    return null;
  if (process.env.NODE_ENV === "production" && origin.protocol !== "https:")
    return null;
  return {
    ...parsed.data,
    origin: origin.origin,
    redirectUri: `${origin.origin}/api/connectors/shopify/callback`,
  };
}
export function googleConfiguration() {
  const parsed = z
    .object({
      origin: z.url({ protocol: /^https?$/ }),
      clientId: z.string().min(1),
      clientSecret: z.string().min(1),
      database: z.string().min(1),
    })
    .safeParse({
      origin: process.env.APP_ORIGIN,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      database: process.env.DATABASE_URL,
    });
  if (!parsed.success) return null;
  try {
    credentialKeys();
  } catch {
    return null;
  }
  const origin = new URL(parsed.data.origin);
  if (
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password ||
    (process.env.NODE_ENV === "production" && origin.protocol !== "https:")
  )
    return null;
  return {
    ...parsed.data,
    origin: origin.origin,
    redirectUri: `${origin.origin}/api/connectors/google/callback`,
  };
}
