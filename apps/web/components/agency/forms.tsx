"use client";
import { useActionState, useState } from "react";
import {
  createAgency,
  createInvitation,
  acceptInvitation,
  cancelInvitation,
  revokeAgencyAccess,
} from "../../lib/agency/actions";
import type { AgencyFormState } from "../../lib/agency/validation";
import { Dialog } from "../dialog";
import { Icon } from "../icon";
const initial: AgencyFormState = { error: "" };
function Result({ state }: { state: AgencyFormState }) {
  return (
    <>
      <p className="form-error" role="alert">
        {state.error}
      </p>
      {state.message ? (
        <p className="notice" role="status">
          {state.message}
        </p>
      ) : null}
    </>
  );
}
export function AgencyForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(createAgency, initial);
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="requestId" value={requestId} />
      <label htmlFor="agency-name">Agency name</label>
      <input id="agency-name" name="name" required maxLength={120} />
      <button className="button primary" disabled={pending}>
        {pending ? "Saving…" : "Create agency"}
        <Icon name="arrow" size={16} />
      </button>
      <Result state={state} />
    </form>
  );
}
export function InvitationForm({
  brandId,
  brandName,
  requestId,
}: {
  brandId: string;
  brandName: string;
  requestId: string;
}) {
  const [state, action, pending] = useActionState(createInvitation, initial);
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="requestId" value={requestId} />
      <h2>Invite an agency to {brandName}</h2>
      <label htmlFor="invite-email">Agency administrator’s email</label>
      <input
        id="invite-email"
        name="email"
        type="email"
        required
        maxLength={254}
        autoComplete="off"
      />
      <label htmlFor="invite-access">Brand permissions</label>
      <select id="invite-access" name="access" defaultValue="analyst">
        <option value="analyst">Read-only analyst</option>
        <option value="operator">Connection operator</option>
      </select>
      <p className="muted">
        Analysts can read this brand. Operators also receive permission to
        connect sources once connectors are available. Neither role can manage
        brand access, publish, spend, or transfer ownership.
      </p>
      <button className="button primary" disabled={pending}>
        {pending ? "Creating…" : "Create in-app invitation"}
        <Icon name="arrow" size={16} />
      </button>
      <p className="muted">
        No email is sent. The recipient signs in with this email and opens
        Invitations. Expires in seven days.
      </p>
      <Result state={state} />
    </form>
  );
}
export function AcceptInvitationForm({
  invitationId,
  agencies,
}: {
  invitationId: string;
  agencies: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(acceptInvitation, initial);
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="invitationId" value={invitationId} />
      <label htmlFor={`agency-${invitationId}`}>Accept for your agency</label>
      <select
        id={`agency-${invitationId}`}
        name="agencyId"
        required
        defaultValue=""
      >
        <option value="" disabled>
          Select an agency
        </option>
        {agencies.map((agency) => (
          <option key={agency.id} value={agency.id}>
            {agency.name}
          </option>
        ))}
      </select>
      <button className="button primary" disabled={pending}>
        {pending ? "Checking permissions…" : "Accept invitation"}
        <Icon name="arrow" size={16} />
      </button>
      <Result state={state} />
    </form>
  );
}
export function CancelInvitationForm({
  brandId,
  invitationId,
}: {
  brandId: string;
  invitationId: string;
}) {
  const [state, action, pending] = useActionState(cancelInvitation, initial);
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="targetId" value={invitationId} />
      <button className="button outline" disabled={pending}>
        {pending ? "Cancelling…" : "Cancel invitation"}
      </button>
      <Result state={state} />
    </form>
  );
}
export function RevokeAccessForm({
  brandId,
  brandName,
  grantId,
  agencyId,
}: {
  brandId: string;
  brandName: string;
  grantId: string;
  agencyId: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(revokeAgencyAccess, initial);
  return (
    <>
      <button className="button outline" onClick={() => setOpen(true)}>
        Revoke access
      </button>
      {open ? (
        <Dialog title="Revoke agency access?" onClose={() => setOpen(false)}>
          <p>
            Brand: <strong>{brandName}</strong>
          </p>
          <p>
            Agency ID: <code>{agencyId}</code>
          </p>
          <p>
            Further database requests through this agency grant will be denied.
            This does not delete brand data, transfer ownership, or disconnect
            external accounts.
          </p>
          <form action={action} className="auth-form">
            <input type="hidden" name="brandId" value={brandId} />
            <input type="hidden" name="targetId" value={grantId} />
            <label className="checkbox-label">
              <input type="checkbox" name="confirm" required />
              Revoke this agency’s access to {brandName}.
            </label>
            <button className="button primary" disabled={pending}>
              {pending ? "Revoking…" : "Confirm revocation"}
            </button>
            <Result state={state} />
          </form>
        </Dialog>
      ) : null}
    </>
  );
}
