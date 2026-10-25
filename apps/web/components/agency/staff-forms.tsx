"use client";
import { useActionState, useId } from "react";
import {
  inviteStaff,
  changeStaff,
  type StaffState,
} from "../../lib/agency/staff";
function Feedback({ state }: { state: StaffState }) {
  return (
    <>
      <p role="alert" className="form-error">
        {state.error}
      </p>
      {state.message ? <p role="status">{state.message}</p> : null}
    </>
  );
}
export function InviteStaffForm({
  agency,
  name,
}: {
  agency: string;
  name: string;
}) {
  const [state, action, pending] = useActionState(inviteStaff, { error: "" });
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="agency" value={agency} />
      <label htmlFor="staff-email">Staff email</label>
      <input
        id="staff-email"
        name="email"
        type="email"
        maxLength={254}
        required
      />
      <label className="checkbox-label">
        <input type="checkbox" name="confirm" required />
        Invite this person to {name}. Upon acceptance, they inherit this
        agency’s current brand grants.
      </label>
      <button className="button primary" disabled={pending}>
        Save staff invitation
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function StaffAction({
  operation,
  id,
  agency,
  label,
}: {
  operation: "accept" | "cancel" | "revoke";
  id: string;
  agency?: string;
  label: string;
}) {
  const [state, action, pending] = useActionState(changeStaff, { error: "" });
  const checkbox = useId();
  return (
    <form action={action}>
      <input type="hidden" name="operation" value={operation} />
      <input type="hidden" name="id" value={id} />
      {agency ? <input type="hidden" name="agency" value={agency} /> : null}
      {operation === "revoke" ? (
        <label className="checkbox-label" htmlFor={checkbox}>
          <input id={checkbox} type="checkbox" name="confirm" required />
          Remove {label} from this agency and its client grants.
        </label>
      ) : null}
      <button className="button outline" disabled={pending}>
        {operation === "revoke"
          ? "Revoke membership"
          : operation === "cancel"
            ? "Cancel invitation"
            : `Join agency ${label}`}
      </button>
      <Feedback state={state} />
    </form>
  );
}
