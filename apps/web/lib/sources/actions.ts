"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "../auth/session";
import {
  sourceSchema,
  sourceStateSchema,
  type SourceFormState,
} from "./validation";
export async function registerSource(
  _previous: SourceFormState,
  form: FormData,
): Promise<SourceFormState> {
  const input = sourceSchema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return {
      error:
        "Choose a provider and enter a label and account reference without spaces.",
    };
  const { client } = await requireUser();
  const value = input.data;
  const { error } = await client.rpc("register_brand_source", {
    target_brand: value.brandId,
    source_provider: value.provider,
    source_label: value.label,
    source_reference: value.reference,
  });
  if (error)
    return {
      error:
        "Source could not be saved. Check your connection permissions and try again.",
    };
  revalidatePath("/connections");
  return {
    error: "",
    message:
      "Source record saved or already present. Provider access has not been verified; no data has been imported.",
  };
}
export async function changeSourceState(
  _previous: SourceFormState,
  form: FormData,
): Promise<SourceFormState> {
  const input = sourceStateSchema.safeParse(Object.fromEntries(form));
  if (!input.success)
    return { error: "Confirm the change for this source account." };
  const { client } = await requireUser();
  const value = input.data;
  const { error } = await client.rpc("set_brand_source_state", {
    target_brand: value.brandId,
    source_id: value.sourceId,
    expected_version: value.version,
    next_state: value.state,
  });
  if (error)
    return {
      error:
        error.code === "40001"
          ? "This source changed. Reload before trying again."
          : "Source could not be changed. Your connection permissions may have changed.",
    };
  revalidatePath("/connections");
  return {
    error: "",
    message:
      value.state === "disabled"
        ? "Local source access disabled and pending runs cancelled. The provider-side app installation is unchanged."
        : "Source resumed. Fresh provider authorization is required.",
  };
}
