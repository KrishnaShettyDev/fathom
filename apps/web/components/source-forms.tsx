"use client";
import { useActionState } from "react";
import { registerSource, changeSourceState } from "../lib/sources/actions";
import { providers, type SourceFormState } from "../lib/sources/validation";
import type { Database } from "../lib/supabase/database.types";
function Result({ state }: { state: SourceFormState }) {
  return (
    <>
      <p role="alert" className="form-error">
        {state.error}
      </p>
      {state.message ? (
        <p role="status" className="notice">
          {state.message}
        </p>
      ) : null}
    </>
  );
}
export function RegisterSourceForm({ brandId }: { brandId: string }) {
  const [state, action, pending] = useActionState(registerSource, {
    error: "",
  });
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={brandId} />
      <label htmlFor="source-provider">Source provider</label>
      <select id="source-provider" name="provider">
        {Object.entries(providers).map(([id, label]) => (
          <option key={id} value={id}>
            {label}
          </option>
        ))}
      </select>
      <label htmlFor="source-label">Account label</label>
      <input id="source-label" name="label" required maxLength={120} />
      <label htmlFor="source-reference">
        Store domain or property reference
      </label>
      <input
        id="source-reference"
        name="reference"
        required
        maxLength={254}
        autoComplete="off"
      />
      <p className="muted">
        Use the identifier shown in your provider account. This saves your
        intended account; it does not verify access. Do not enter passwords, API
        keys or tokens.
      </p>
      <button className="button primary" disabled={pending}>
        {pending ? "Saving…" : "Save account for setup"}
      </button>
      <Result state={state} />
    </form>
  );
}
export function SourceStateForm({
  source,
  brandName,
}: {
  source: Database["public"]["Tables"]["brand_sources"]["Row"];
  brandName: string;
}) {
  const [state, action, pending] = useActionState(changeSourceState, {
    error: "",
  });
  const disabling = source.state !== "disabled";
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={source.brand_id} />
      <input type="hidden" name="sourceId" value={source.id} />
      <input type="hidden" name="version" value={source.version} />
      <input
        type="hidden"
        name="state"
        value={disabling ? "disabled" : "awaiting_authorization"}
      />
      <label className="checkbox-label">
        <input name="confirm" type="checkbox" required />
        {disabling ? "Disable" : "Resume"} setup for {source.account_label} in{" "}
        {brandName}.
      </label>
      <button className="button outline" disabled={pending}>
        {pending
          ? "Saving…"
          : disabling
            ? "Disable source access"
            : "Resume setup"}
      </button>
      <Result state={state} />
    </form>
  );
}
