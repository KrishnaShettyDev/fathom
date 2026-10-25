import { z } from "zod";
export const providers = {
  shopify: "Shopify",
  gsc: "Google Search Console",
  ga4: "Google Analytics 4",
} as const;
export const sourceSchema = z.object({
  brandId: z.uuid(),
  provider: z.enum(["shopify", "gsc", "ga4"]),
  label: z.string().trim().min(1).max(120),
  reference: z.string().trim().min(1).max(254).regex(/^\S+$/),
});
export const sourceStateSchema = z.object({
  brandId: z.uuid(),
  sourceId: z.uuid(),
  version: z.coerce.number().int().positive(),
  state: z.enum(["awaiting_authorization", "disabled"]),
  confirm: z.literal("on"),
});
export type SourceFormState = { error: string; message?: string };
