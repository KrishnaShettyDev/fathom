import { z } from "zod";
import { emailSchema } from "../auth/validation";
export const agencySchema = z.object({
  name: z.string().trim().min(1).max(120),
  requestId: z.uuid(),
});
export const invitationSchema = z.object({
  brandId: z.uuid(),
  email: emailSchema,
  access: z.enum(["analyst", "operator"]),
  requestId: z.uuid(),
});
export const acceptanceSchema = z.object({
  invitationId: z.uuid(),
  agencyId: z.uuid(),
});
export const accessTargetSchema = z.object({
  brandId: z.uuid(),
  targetId: z.uuid(),
});
export type AgencyFormState = { error: string; message?: string };
