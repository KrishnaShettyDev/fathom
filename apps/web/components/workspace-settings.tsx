"use client";
import { useActionState } from "react";
import {
  saveSettings,
  acknowledgeBaseline,
  type SettingsState,
} from "../lib/workspaces/settings";
function Feedback({ state }: { state: SettingsState }) {
  return (
    <>
      <p role="alert" className="form-error">
        {state.error}
      </p>
      {state.message ? <p role="status">{state.message}</p> : null}
    </>
  );
}
export function WorkspaceSettings({
  brand,
}: {
  brand: {
    id: string;
    name: string;
    website: string | null;
    reporting_timezone: string;
  };
}) {
  const [state, action, pending] = useActionState(saveSettings, { error: "" });
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={brand.id} />
      <label htmlFor="settings-name">Brand name</label>
      <input
        id="settings-name"
        name="brandName"
        defaultValue={brand.name}
        maxLength={120}
        required
      />
      <label htmlFor="settings-website">Website to audit</label>
      <input
        id="settings-website"
        name="website"
        type="url"
        defaultValue={brand.website ?? ""}
        maxLength={2048}
      />
      <label htmlFor="settings-timezone">Reporting timezone</label>
      <input
        id="settings-timezone"
        name="timezone"
        defaultValue={brand.reporting_timezone}
        maxLength={100}
        required
      />
      <button className="button primary" disabled={pending}>
        Save settings
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function BaselineReview({
  brandId,
  requestId,
}: {
  brandId: string;
  requestId: string;
}) {
  const [state, action, pending] = useActionState(acknowledgeBaseline, {
    error: "",
  });
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="requestId" value={requestId} />
      <label htmlFor="baseline-scope">Monitoring scope</label>
      <textarea id="baseline-scope" name="scope" maxLength={4000} required />
      <label htmlFor="baseline-gaps">Known data gaps and limitations</label>
      <textarea id="baseline-gaps" name="gaps" maxLength={4000} required />
      <label htmlFor="baseline-responsibilities">
        Responsibilities and next review
      </label>
      <textarea
        id="baseline-responsibilities"
        name="responsibilities"
        maxLength={4000}
        required
      />
      <label className="checkbox-label">
        <input type="checkbox" name="confirm" required />I reviewed the
        available evidence and acknowledge this baseline for this brand. This
        does not certify release readiness.
      </label>
      <button className="button primary" disabled={pending}>
        Record acknowledgement
      </button>
      <Feedback state={state} />
    </form>
  );
}
