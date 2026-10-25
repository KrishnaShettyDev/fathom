"use client";
import { useActionState } from "react";
import { switchWorkspace } from "../lib/workspaces/actions";
import type { FormState } from "../lib/auth/validation";
const initial: FormState = { error: "" };
export function WorkspaceSwitcher({
  brands,
  activeId,
}: {
  brands: { id: string; name: string }[];
  activeId: string;
}) {
  const [state, action, pending] = useActionState(switchWorkspace, initial);
  return (
    <form action={action} className="auth-form">
      <label htmlFor="brandId">Your workspaces</label>
      <select
        id="brandId"
        name="brandId"
        defaultValue={activeId || brands[0]?.id}
      >
        {brands.map((brand) => (
          <option key={brand.id} value={brand.id}>
            {brand.name}
          </option>
        ))}
      </select>
      <button className="button outline" disabled={pending}>
        {pending ? "Checking access…" : "Switch workspace"}
      </button>
      <p role="alert" className="form-error">
        {state.error}
      </p>
    </form>
  );
}
