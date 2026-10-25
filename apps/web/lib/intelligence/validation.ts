import { z } from "zod";
const text = (max: number) => z.string().trim().min(1).max(max);
const identity = { brandId: z.uuid(), requestId: z.uuid() };
export const createOpportunitySchema = z.object({
  ...identity,
  title: text(180),
  problem: text(4000),
  action: text(4000),
  confidence: text(2000),
  relevance: text(2000),
  affected: text(2048),
  effort: z.enum(["small", "medium", "large"]),
  factId: z.uuid(),
  factVersion: z.coerce.number().int().positive(),
});
export const targetSchema = z.object({
  brandId: z.uuid(),
  id: z.uuid(),
  version: z.coerce.number().int().positive(),
});
export const updateOpportunitySchema = targetSchema.extend({
  state: z.enum(["open", "in_progress", "snoozed", "dismissed", "completed"]),
  priority: z.coerce.number().int().min(1).max(3),
  assignee: z.union([z.uuid(), z.literal("")]),
  snooze: z.union([z.iso.datetime({ offset: true }), z.literal("")]),
  reason: z.string().trim().max(2000),
});
export const commentSchema = z.object({
  brandId: z.uuid(),
  id: z.uuid(),
  body: text(4000),
});
export const reportSchema = z
  .object({
    ...identity,
    title: text(180),
    start: z.iso.date(),
    end: z.iso.date(),
    annotation: z.string().max(4000),
  })
  .refine((v) => v.start <= v.end);
export type ActionState = { error: string; message?: string };
export const reportSnapshotSchema = z.object({
  schema_version: z.union([z.literal(1), z.literal(2)]),
  captured_at: z.string(),
  brand: z.object({
    id: z.string(),
    name: z.string(),
    reporting_timezone: z.string(),
  }),
  methodology: z.string(),
  filters: z.object({
    range_start: z.string(),
    range_end: z.string(),
    date_field: z.string(),
    filter_timezone: z.string(),
    states: z.string(),
  }),
  coverage: z.object({
    opportunities: z.number(),
    analytics: z.number().nullable(),
    observations: z.number().nullable(),
  }),
  sources: z.array(
    z.object({
      provider: z.string(),
      account: z.string(),
      reference: z.string(),
      state: z.string(),
    }),
  ),
  analytics_days: z
    .array(
      z.object({
        id: z.string(),
        observed_date: z.string(),
        provider: z.string(),
        provider_timezone: z.string(),
        state: z.string(),
        metrics: z
          .record(z.string(), z.union([z.string(), z.number()]))
          .nullable(),
        captured_at: z.string(),
      }),
    )
    .default([]),
  research_runs: z
    .array(
      z.object({
        id: z.string(),
        kind: z.string(),
        state: z.string(),
        expected_samples: z.number(),
        created_at: z.string(),
        snapshot: z.unknown(),
        samples: z.array(
          z.object({
            id: z.string(),
            question: z.string(),
            state: z.string(),
            answer: z.string().nullable(),
            mentions: z.record(z.string(), z.boolean()),
            actual_model: z.string().nullable(),
            observed_at: z.string(),
          }),
        ),
        checks: z.array(
          z.object({
            url: z.string(),
            status: z.number().nullable(),
            error_code: z.string().nullable(),
            evidence: z.unknown(),
          }),
        ),
      }),
    )
    .default([]),
  opportunities: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      problem: z.string(),
      proposed_action: z.string(),
      confidence_reason: z.string(),
      business_relevance: z.string(),
      affected_reference: z.string(),
      effort: z.string(),
      priority: z.number(),
      state: z.string(),
      evidence_needs_review: z.boolean(),
      evidence: z.object({
        statement: z.string(),
        source_description: z.string(),
        review_on: z.string(),
        version: z.number(),
      }),
      history: z.array(z.unknown()),
    }),
  ),
});
