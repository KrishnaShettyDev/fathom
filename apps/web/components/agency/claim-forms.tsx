"use client";
import { useActionState, useId } from "react";
import {
  createClaim,
  acceptClaim,
  closeClaim,
  type ClaimState,
} from "../../lib/agency/claims";
function Feedback({ state }: { state: ClaimState }) {
  return (
    <>
      <p role="alert" className="form-error">
        {state.error}
      </p>
      {state.message ? <p role="status">{state.message}</p> : null}
    </>
  );
}
export function CreateClaimForm({
  agencies,
  requestId,
}: {
  agencies: { id: string; name: string }[];
  requestId: string;
}) {
  const [state, action, pending] = useActionState(createClaim, { error: "" });
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="requestId" value={requestId} />
      <label htmlFor="claim-agency">Requesting agency</label>
      <select id="claim-agency" name="agency">
        {agencies.map((agency) => (
          <option key={agency.id} value={agency.id}>
            {agency.name}
          </option>
        ))}
      </select>
      <label htmlFor="claim-name">Client brand</label>
      <input id="claim-name" name="brandName" maxLength={120} required />
      <label htmlFor="claim-email">Owner email</label>
      <input
        id="claim-email"
        name="email"
        type="email"
        maxLength={254}
        required
      />
      <label htmlFor="claim-website">Website</label>
      <input id="claim-website" name="website" type="url" maxLength={2048} />
      <label htmlFor="claim-zone">Reporting timezone</label>
      <input
        id="claim-zone"
        name="timezone"
        defaultValue="UTC"
        maxLength={100}
        required
      />
      <label className="checkbox-label">
        <input type="checkbox" name="confirm" required />I am authorized to
        initiate setup for this client. This does not establish my agency as the
        brand owner.
      </label>
      <button className="button primary" disabled={pending}>
        Save unclaimed setup
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function AcceptClaimForm({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(acceptClaim, { error: "" });
  const field = useId();
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={field}>Owner organization</label>
      <input id={field} name="organization" maxLength={120} required />
      <label className="checkbox-label">
        <input type="checkbox" name="confirm" required />I am authorized to
        establish ownership of {name} for this organization. This creates a new
        owner workspace; agency access requires my separate invitation.
      </label>
      <button className="button primary" disabled={pending}>
        Claim this brand setup
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function CloseClaimForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(closeClaim, { error: "" });
  const field = useId();
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="id" value={id} />
      <label htmlFor={`${field}-decision`}>Close this request</label>
      <select id={`${field}-decision`} name="decision">
        <option value="cancelled">Cancel</option>
        <option value="disputed">Record an ownership dispute</option>
      </select>
      <label htmlFor={field}>Reason</label>
      <textarea id={field} name="reason" maxLength={2000} required />
      <button className="button outline" disabled={pending}>
        Close request
      </button>
      <Feedback state={state} />
    </form>
  );
}
