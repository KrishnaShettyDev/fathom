"use client";
import { useActionState } from "react";
import { createWorkspace } from "../lib/workspaces/actions";
import type { FormState } from "../lib/auth/validation";
import { Icon } from "./icon";
const initial: FormState = { error: "" };
export function OnboardingForm({ requestId }: { requestId: string }) {
  const [state, action, pending] = useActionState(createWorkspace, initial);
  return (
    <form action={action} className="auth-form onboarding-form">
      <input type="hidden" name="requestId" value={requestId} />
      <div className="form-columns">
        <div>
          <label htmlFor="organizationName">Organization name</label>
          <input
            id="organizationName"
            name="organizationName"
            required
            maxLength={120}
            autoComplete="organization"
          />
        </div>
        <div>
          <label htmlFor="brandName">Brand name</label>
          <input id="brandName" name="brandName" required maxLength={120} />
        </div>
      </div>
      <label htmlFor="website">
        Website <span className="muted">(optional)</span>
      </label>
      <input
        id="website"
        name="website"
        type="url"
        placeholder="https://yourbrand.com"
        maxLength={2048}
        autoComplete="url"
      />
      <label htmlFor="timezone">Reporting timezone</label>
      <input
        id="timezone"
        name="timezone"
        defaultValue="UTC"
        required
        maxLength={100}
        list="timezones"
      />
      <datalist id="timezones">
        <option value="UTC" />
        <option value="Asia/Kolkata" />
        <option value="America/New_York" />
        <option value="America/Los_Angeles" />
        <option value="Europe/London" />
        <option value="Australia/Sydney" />
      </datalist>
      <small>
        Use an IANA timezone, such as Asia/Kolkata or America/New_York.
      </small>
      <label className="checkbox-label">
        <input type="checkbox" name="ownerAttested" required />I am authorized
        to create this workspace for my organization’s brand.
      </label>
      <div className="notice">
        Creating a workspace saves these details. It does not connect your
        website, import products, or claim ownership of external accounts.
        Agency-created client workspaces are not supported in this step.
      </div>
      <button className="button primary" disabled={pending}>
        {pending ? "Saving workspace…" : "Create brand workspace"}
        <Icon name="arrow" size={16} />
      </button>
      <p className="form-error" role="alert">
        {state.error}
      </p>
    </form>
  );
}
