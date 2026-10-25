"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "../auth/session";
import { factSchema, reviewSchema, type FactFormState } from "./validation";
function failure(code: string): FactFormState {
  return {
    error:
      code === "40001"
        ? "This fact changed. Reload and review the latest version before submitting."
        : "Unable to save. Check your brand permissions, required fields and review date.",
  };
}
export async function saveFact(
  _previous: FactFormState,
  form: FormData,
): Promise<FactFormState> {
  const input = factSchema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return {
      error:
        "Complete the fact, source, owner and review date. Source links must use HTTP or HTTPS.",
    };
  const { client } = await requireUser();
  const value = input.data;
  const payload = {
    target_brand: value.brandId,
    creation_request_id: value.requestId,
    fact_category: value.category,
    fact_statement: value.statement,
    source_note: value.source,
    source_link: value.sourceUrl,
    fact_owner: value.owner,
    review_date: value.reviewOn,
  };
  const { data, error } = value.factId
    ? await client.rpc("save_brand_fact", {
        ...payload,
        fact_id: value.factId,
        expected_version: value.version,
      })
    : await client.rpc("create_brand_fact", payload);
  if (error) return failure(error.code);
  revalidatePath("/knowledge", "layout");
  redirect(`/knowledge/${data}`);
}
export async function reviewFact(
  _previous: FactFormState,
  form: FormData,
): Promise<FactFormState> {
  const input = reviewSchema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Confirm the decision for this exact version." };
  const { client } = await requireUser();
  const value = input.data;
  const { error } = await client.rpc("review_brand_fact", {
    target_brand: value.brandId,
    fact_id: value.factId,
    expected_version: value.version,
    decision: value.decision,
  });
  if (error) return failure(error.code);
  revalidatePath("/knowledge", "layout");
  redirect(`/knowledge/${value.factId}`);
}
