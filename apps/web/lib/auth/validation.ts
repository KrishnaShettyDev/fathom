import { z } from "zod";
export const emailSchema = z
  .email()
  .max(254)
  .transform((value) => value.toLowerCase());
export const otpSchema = z.string().regex(/^\d{6}$/);
export const workspaceSchema = z.object({
  organizationName: z.string().trim().min(1).max(120),
  brandName: z.string().trim().min(1).max(120),
  website: z.union([z.literal(""), z.url({ protocol: /^https?$/ }).max(2048)]),
  timezone: z
    .string()
    .min(1)
    .max(100)
    .refine((value) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }),
  requestId: z.uuid(),
  ownerAttested: z.literal("on"),
});
export type FormState = { error: string; email?: string; sentAt?: number };
