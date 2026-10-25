"use client";
import { useActionState, useId } from "react";
import {
  createCohort,
  requestResearch,
  observationAllowance,
  scheduleCohort,
  cancelResearch,
  type ResearchState,
} from "../lib/research/actions";
function Feedback({ state }: { state: ResearchState }) {
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
export function CohortForm({
  brandId,
  model,
}: {
  brandId: string;
  model: string;
}) {
  const [state, action, pending] = useActionState(createCohort, { error: "" });
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={brandId} />
      <label htmlFor="cohort-name">Cohort name</label>
      <input id="cohort-name" name="name" maxLength={120} required />
      <label htmlFor="cohort-questions">
        Questions (one per line, up to five)
      </label>
      <textarea
        id="cohort-questions"
        name="questions"
        rows={5}
        maxLength={5004}
        required
      />
      <label htmlFor="cohort-competitors">
        Competitor names (one per line, up to four)
      </label>
      <textarea id="cohort-competitors" name="competitors" maxLength={483} />
      <label htmlFor="cohort-market">Requested market</label>
      <input id="cohort-market" name="market" maxLength={120} required />
      <label htmlFor="cohort-language">Requested language</label>
      <input id="cohort-language" name="language" maxLength={80} required />
      <label htmlFor="cohort-model">Exact model identifier</label>
      <input
        id="cohort-model"
        name="model"
        maxLength={120}
        required
        defaultValue={model}
      />
      <label htmlFor="cohort-samples">Samples per question</label>
      <input
        id="cohort-samples"
        name="samples"
        type="number"
        min={1}
        max={3}
        defaultValue={1}
        required
      />
      <label className="checkbox-label">
        <input name="confirm" type="checkbox" required />I have permission to
        submit these questions and retain the returned evidence. This is API
        sampling, not consumer-interface measurement.
      </label>
      <button className="button primary" disabled={pending}>
        Save fixed cohort
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function ResearchRequestForm({
  brandId,
  kind,
  cohort = "",
  requestId,
  target,
  enabled = true,
}: {
  brandId: string;
  kind: "audit" | "observation";
  cohort?: string;
  requestId: string;
  target: string;
  enabled?: boolean;
}) {
  const [state, action, pending] = useActionState(requestResearch, {
    error: "",
  });
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="cohort" value={cohort} />
      <input type="hidden" name="requestId" value={requestId} />
      <label className="checkbox-label">
        <input type="checkbox" name="confirm" required disabled={!enabled} />
        Collect{" "}
        {kind === "audit"
          ? "a bounded website audit"
          : "API observation samples"}{" "}
        for {target}.
      </label>
      <button className="button primary" disabled={pending || !enabled}>
        {pending
          ? "Queuing…"
          : enabled
            ? "Request collection"
            : "Provider configuration pending"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function ObservationAllowanceForm({
  brandId,
  limit,
}: {
  brandId: string;
  limit: number;
}) {
  const [state, action, pending] = useActionState(observationAllowance, {
    error: "",
  });
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={brandId} />
      <label htmlFor="obs-limit">Monthly API request allowance (UTC)</label>
      <input
        id="obs-limit"
        name="limit"
        type="number"
        min={0}
        max={1000}
        defaultValue={limit}
        required
      />
      <label className="checkbox-label">
        <input type="checkbox" name="confirm" required />I understand provider
        requests may incur charges. Each sample uses at most 1,000 output
        tokens; failed or uncertain requests retain their reservation.
      </label>
      <button className="button outline" disabled={pending}>
        Save allowance
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function ScheduleCohortForm({
  brandId,
  cohort,
  days,
  enabled,
}: {
  brandId: string;
  cohort: string;
  days: number;
  enabled: boolean;
}) {
  const [state, action, pending] = useActionState(scheduleCohort, {
    error: "",
  });
  const id = useId();
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="cohort" value={cohort} />
      <label htmlFor={id}>Repeat every (days)</label>
      <input
        id={id}
        name="days"
        type="number"
        min={1}
        max={30}
        defaultValue={days}
        required
      />
      <label className="checkbox-label">
        <input name="enabled" type="checkbox" defaultChecked={enabled} />
        Enable scheduled collection within the allowance.
      </label>
      <button className="button outline" disabled={pending}>
        Save schedule
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function CancelResearchForm({
  brandId,
  runId,
}: {
  brandId: string;
  runId: string;
}) {
  const [state, action, pending] = useActionState(cancelResearch, {
    error: "",
  });
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="runId" value={runId} />
      <button className="button outline" disabled={pending}>
        Cancel remaining collection
      </button>
      <Feedback state={state} />
    </form>
  );
}
