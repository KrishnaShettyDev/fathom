import { z } from "zod";
export const categories = [
  "product",
  "positioning",
  "audience",
  "tone",
  "prohibited_claim",
  "market",
  "goal",
  "commercial",
] as const;
export const factSchema = z.object({
  brandId: z.uuid(),
  factId: z.union([z.uuid(), z.literal("")]),
  version: z.coerce.number().int().min(0),
  requestId: z.uuid(),
  category: z.enum(categories),
  statement: z.string().trim().min(1).max(4000),
  source: z.string().trim().min(1).max(2000),
  sourceUrl: z.union([
    z.url({ protocol: /^https?$/ }).max(2048),
    z.literal(""),
  ]),
  owner: z.string().trim().min(1).max(120),
  reviewOn: z.iso.date(),
});
export const reviewSchema = z.object({
  brandId: z.uuid(),
  factId: z.uuid(),
  version: z.coerce.number().int().positive(),
  decision: z.enum(["approved", "archived"]),
  confirm: z.literal("on"),
});
export type FactFormState = { error: string };
export const revisionSnapshotSchema = z.object({
  statement: z.string(),
  category: z.string(),
  source_description: z.string(),
  source_url: z.string().nullable(),
  responsible_owner: z.string(),
  review_on: z.string(),
  state: z.enum(["pending", "approved", "archived"]),
});
