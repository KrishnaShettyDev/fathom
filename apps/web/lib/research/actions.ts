"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "../auth/session";
export type ResearchState = { error: string; message?: string };
const lines = (max: number) =>
  z
    .string()
    .transform((v) =>
      v
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().min(1).max(max)));
export async function createCohort(
  _previous: ResearchState,
  form: FormData,
): Promise<ResearchState> {
  const input = z
    .object({
      brandId: z.uuid(),
      name: z.string().trim().min(1).max(120),
      questions: lines(1000).refine((v) => v.length >= 1 && v.length <= 5),
      competitors: lines(120).refine((v) => v.length <= 4),
      market: z.string().trim().min(1).max(120),
      language: z.string().trim().min(1).max(80),
      model: z.string().trim().min(1).max(120),
      samples: z.coerce.number().int().min(1).max(3),
      confirm: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return {
      error:
        "Complete the cohort, up to five questions and four competitors, and confirm collection permission.",
    };
  const v = input.data;
  const { client } = await requireUser();
  const { error } = await client.rpc("create_observation_cohort", {
    target_brand: v.brandId,
    cohort_name: v.name,
    question_list: v.questions,
    competitors: v.competitors,
    requested_market: v.market,
    requested_language: v.language,
    model_id: v.model,
    sample_count: v.samples,
    permission_confirmed: true,
  });
  if (error)
    return {
      error:
        "Cohort could not be saved. Check brand permissions and distinct subject names.",
    };
  revalidatePath("/visibility");
  return {
    error: "",
    message:
      "Fixed cohort saved. Questions are hypotheses, not measured demand.",
  };
}
export async function requestResearch(
  _previous: ResearchState,
  form: FormData,
): Promise<ResearchState> {
  const input = z
    .object({
      brandId: z.uuid(),
      kind: z.enum(["audit", "observation"]),
      cohort: z.union([z.uuid(), z.literal("")]),
      requestId: z.uuid(),
      confirm: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return {
      error: "Confirm this collection for the displayed brand and target.",
    };
  const v = input.data;
  if (
    v.kind === "observation" &&
    (process.env.OBSERVATIONS_ENABLED !== "true" ||
      !process.env.OBSERVATION_MODEL)
  )
    return {
      error:
        "Observation provider configuration is pending. No request was made.",
    };
  const { client } = await requireUser();
  const { data, error } = await client.rpc("request_research", {
    target_brand: v.brandId,
    research_kind: v.kind,
    cohort: v.cohort,
    creation_request_id: v.requestId,
  });
  if (error)
    return {
      error:
        error.code === "54000"
          ? "Collection allowance exhausted. Existing evidence remains available."
          : "Cannot queue collection. Check the saved website/cohort, current access and whether another run is active.",
    };
  revalidatePath("/audit");
  revalidatePath("/visibility");
  redirect(`/research/${data}`);
}
export async function observationAllowance(
  _previous: ResearchState,
  form: FormData,
): Promise<ResearchState> {
  const input = z
    .object({
      brandId: z.uuid(),
      limit: z.coerce.number().int().min(0).max(1000),
      confirm: z.literal("on"),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Confirm a monthly request limit from 0 to 1000." };
  const { client } = await requireUser();
  const { error } = await client.rpc("set_observation_allowance", {
    target_brand: input.data.brandId,
    request_limit: input.data.limit,
  });
  if (error) return { error: "Allowance could not be saved." };
  revalidatePath("/visibility");
  return {
    error: "",
    message:
      "Request allowance updated. Provider charges are separate; no currency budget is inferred.",
  };
}
export async function scheduleCohort(
  _previous: ResearchState,
  form: FormData,
): Promise<ResearchState> {
  const input = z
    .object({
      brandId: z.uuid(),
      cohort: z.uuid(),
      days: z.coerce.number().int().min(1).max(30),
    })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Choose a schedule from 1 to 30 days." };
  const enabled = form.get("enabled") === "on";
  if (
    enabled &&
    (process.env.OBSERVATIONS_ENABLED !== "true" ||
      !process.env.OBSERVATION_MODEL)
  )
    return {
      error: "Configure the observation provider before enabling a schedule.",
    };
  const { client } = await requireUser();
  const { error } = await client.rpc("schedule_observation_cohort", {
    target_brand: input.data.brandId,
    cohort: input.data.cohort,
    enabled,
    frequency_days: input.data.days,
  });
  if (error) return { error: "Schedule could not be updated." };
  revalidatePath("/visibility");
  return {
    error: "",
    message: enabled
      ? "Schedule enabled within the monthly request allowance."
      : "Schedule disabled. Existing runs and evidence remain.",
  };
}
export async function cancelResearch(
  _previous: ResearchState,
  form: FormData,
): Promise<ResearchState> {
  const input = z
    .object({ brandId: z.uuid(), runId: z.uuid() })
    .safeParse(Object.fromEntries(form));
  if (!input.success) return { error: "Invalid run selection." };
  const { client } = await requireUser();
  const { error } = await client.rpc("cancel_research", {
    target_brand: input.data.brandId,
    run: input.data.runId,
  });
  if (error) return { error: "Run could not be cancelled." };
  revalidatePath(`/research/${input.data.runId}`);
  return {
    error: "",
    message:
      "Cancellation saved. An in-flight provider request may still be billed; later results cannot be committed.",
  };
}
