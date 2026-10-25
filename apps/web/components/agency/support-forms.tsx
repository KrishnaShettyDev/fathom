"use client";
import { useActionState } from "react";
import {
  grantSupport,
  revokeSupport,
  type SupportState,
} from "../../lib/agency/support";
function Feedback({ state }: { state: SupportState }) {
  return (
    <>
      <p role="alert" className="form-error">
        {state.error}
      </p>
      {state.message ? <p role="status">{state.message}</p> : null}
    </>
  );
}
export function SupportForm({
  brandId,
  brandName,
}: {
  brandId: string;
  brandName: string;
}) {
  const [state, action, pending] = useActionState(grantSupport, { error: "" });
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={brandId} />
      <label htmlFor="support-email">Verified account email</label>
      <input
        id="support-email"
        name="email"
        type="email"
        maxLength={254}
        required
      />
      <label htmlFor="support-purpose">Purpose</label>
      <textarea id="support-purpose" name="purpose" maxLength={1000} required />
      <label htmlFor="support-access">Access</label>
      <select id="support-access" name="access">
        <option value="analyst">Read-only analyst</option>
        <option value="operator">Read and manage source connections</option>
      </select>
      <label htmlFor="support-hours">Duration in hours (1–24)</label>
      <input
        id="support-hours"
        name="hours"
        type="number"
        min={1}
        max={24}
        defaultValue={1}
        required
      />
      <label className="checkbox-label">
        <input name="confirm" type="checkbox" required />
        Grant this recipient the selected temporary access to {brandName}. They
        cannot change ownership, approve facts or raise collection allowances.
      </label>
      <button className="button primary" disabled={pending}>
        Grant temporary access
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function RevokeSupportForm({
  brandId,
  sessionId,
}: {
  brandId: string;
  sessionId: string;
}) {
  const [state, action, pending] = useActionState(revokeSupport, { error: "" });
  return (
    <form action={action}>
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="sessionId" value={sessionId} />
      <button className="button outline" disabled={pending}>
        Revoke this session
      </button>
      <Feedback state={state} />
    </form>
  );
}
