"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "../auth/session";
import {
  createOpportunitySchema,
  updateOpportunitySchema,
  commentSchema,
  targetSchema,
  reportSchema,
  type ActionState,
} from "./validation";
function failed(code: string): ActionState {
  return {
    error:
      code === "40001"
        ? "This item changed. Reload and review the current version."
        : "Unable to save. Check your permissions, evidence freshness and required fields.",
  };
}
export async function createOpportunity(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = createOpportunitySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      error: "Complete every field and choose an approved evidence version.",
    };
  const v = parsed.data;
  const { client } = await requireUser();
  const { data, error } = await client.rpc("create_opportunity", {
    target_brand: v.brandId,
    creation_request_id: v.requestId,
    opportunity_title: v.title,
    problem_description: v.problem,
    action_description: v.action,
    confidence_description: v.confidence,
    relevance_description: v.relevance,
    affected: v.affected,
    effort_size: v.effort,
    evidence_fact: v.factId,
    evidence_version: v.factVersion,
  });
  if (error) return failed(error.code);
  revalidatePath("/opportunities", "layout");
  redirect(`/opportunities/${data}`);
}
export async function updateOpportunity(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = updateOpportunitySchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return {
      error:
        "Check status, priority, assignee and snooze time (ISO date and time with timezone).",
    };
  const v = parsed.data;
  const { client } = await requireUser();
  const { error } = await client.rpc("update_opportunity", {
    target_brand: v.brandId,
    opportunity: v.id,
    expected_version: v.version,
    next_state: v.state,
    next_priority: v.priority,
    assignee: v.assignee,
    snooze_to: v.snooze,
    reason: v.reason,
  });
  if (error) return failed(error.code);
  revalidatePath("/opportunities", "layout");
  return { error: "", message: "Workflow updated." };
}
export async function commentOpportunity(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = commentSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "Enter a comment of 1–4000 characters." };
  const v = parsed.data;
  const { client } = await requireUser();
  const { error } = await client.rpc("comment_opportunity", {
    target_brand: v.brandId,
    opportunity: v.id,
    comment_body: v.body,
  });
  if (error) return failed(error.code);
  revalidatePath(`/opportunities/${v.id}`);
  return { error: "", message: "Comment saved." };
}
export async function refreshEvidence(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = targetSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success || form.get("confirm") !== "on")
    return { error: "Confirm you reviewed the current approved fact." };
  const v = parsed.data;
  const { client } = await requireUser();
  const { error } = await client.rpc("refresh_opportunity_evidence", {
    target_brand: v.brandId,
    opportunity: v.id,
    expected_version: v.version,
  });
  if (error) return failed(error.code);
  revalidatePath(`/opportunities/${v.id}`);
  return { error: "", message: "Current evidence version recorded." };
}
export async function createReport(
  _state: ActionState,
  form: FormData,
): Promise<ActionState> {
  const parsed = reportSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: "Enter a title and valid inclusive date range." };
  const v = parsed.data;
  const { client } = await requireUser();
  const { data, error } = await client.rpc("create_client_report", {
    target_brand: v.brandId,
    creation_request_id: v.requestId,
    report_title: v.title,
    start_date: v.start,
    end_date: v.end,
    report_annotation: v.annotation,
  });
  if (error)
    return {
      error:
        error.code === "22023"
          ? "Select a smaller date range (at most 367 dates, 500 opportunities and 2 MB)."
          : "Report could not be created. Check your permissions and required fields.",
    };
  revalidatePath("/reports", "layout");
  redirect(`/reports/${data}`);
}
