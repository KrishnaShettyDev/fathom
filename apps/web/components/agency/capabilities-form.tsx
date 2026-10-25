"use client";
import { useActionState } from "react";
import { saveAgencyCapabilities } from "../../lib/agency/capabilities";
const options = [
  { value: "knowledge.write", label: "Propose and correct facts" },
  { value: "knowledge.approve", label: "Approve and archive facts" },
  {
    value: "opportunities.manage",
    label: "Create, assign and track opportunities",
  },
  { value: "reports.create", label: "Create immutable reports" },
];
export function AgencyCapabilitiesForm({
  brandId,
  brandName,
  grant,
}: {
  brandId: string;
  brandName: string;
  grant: {
    id: string;
    agency_organization_id: string;
    capabilities: string[];
    permission_version: number;
  };
}) {
  const [state, action, pending] = useActionState(saveAgencyCapabilities, {
    error: "",
  });
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="grantId" value={grant.id} />
      <input type="hidden" name="version" value={grant.permission_version} />
      <fieldset>
        <legend>Intelligence workflow permissions</legend>
        {options.map((option) => (
          <label className="checkbox-label" key={option.value}>
            <input
              type="checkbox"
              name="capabilities"
              value={option.value}
              defaultChecked={grant.capabilities.includes(option.value)}
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      <label className="checkbox-label">
        <input type="checkbox" name="confirm" required />
        Apply these permissions to agency {
          grant.agency_organization_id
        } for {brandName}.
      </label>
      <button className="button outline" disabled={pending}>
        Save agency permissions
      </button>
      <p role="alert" className="form-error">
        {state.error}
      </p>
      {state.message ? <p role="status">{state.message}</p> : null}
    </form>
  );
}
