"use client";
import { useActionState } from "react";
import {
  createOpportunity,
  updateOpportunity,
  commentOpportunity,
  refreshEvidence,
  createReport,
} from "../../lib/intelligence/actions";
import type { ActionState } from "../../lib/intelligence/validation";
import type { Database } from "../../lib/supabase/database.types";
function Feedback({ state }: { state: ActionState }) {
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
export function OpportunityForm({
  brandId,
  requestId,
  factId,
  factVersion,
}: {
  brandId: string;
  requestId: string;
  factId: string;
  factVersion: number;
}) {
  const [state, action, pending] = useActionState(createOpportunity, {
    error: "",
  });
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="factId" value={factId} />
      <input type="hidden" name="factVersion" value={factVersion} />
      <p>
        Supporting fact version: {factVersion}. The database checks its current
        approval and review date.
      </p>
      <label htmlFor="op-title">Opportunity title</label>
      <input id="op-title" name="title" required maxLength={180} />
      <label htmlFor="op-problem">Problem</label>
      <textarea id="op-problem" name="problem" required maxLength={4000} />
      <label htmlFor="op-affected">Affected page or product reference</label>
      <input id="op-affected" name="affected" required maxLength={2048} />
      <label htmlFor="op-action">Proposed action</label>
      <textarea id="op-action" name="action" required maxLength={4000} />
      <label htmlFor="op-confidence">Evidence and uncertainty</label>
      <textarea
        id="op-confidence"
        name="confidence"
        required
        maxLength={2000}
      />
      <label htmlFor="op-relevance">Business relevance</label>
      <textarea id="op-relevance" name="relevance" required maxLength={2000} />
      <label htmlFor="op-effort">Effort estimate</label>
      <select id="op-effort" name="effort">
        <option value="small">Small</option>
        <option value="medium">Medium</option>
        <option value="large">Large</option>
      </select>
      <button className="button primary" disabled={pending}>
        {pending ? "Saving…" : "Create opportunity"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
type Opportunity = Database["public"]["Tables"]["opportunities"]["Row"];
function Target({ item }: { item: Opportunity }) {
  return (
    <>
      <input type="hidden" name="brandId" value={item.brand_id} />
      <input type="hidden" name="id" value={item.id} />
      <input type="hidden" name="version" value={item.version} />
    </>
  );
}
export function WorkflowForm({
  item,
  assignees,
}: {
  item: Opportunity;
  assignees: { user_id: string; email: string }[];
}) {
  const [state, action, pending] = useActionState(updateOpportunity, {
    error: "",
  });
  return (
    <form action={action} className="auth-form">
      <Target item={item} />
      <label htmlFor="workflow-state">Status</label>
      <select id="workflow-state" name="state" defaultValue={item.state}>
        {["open", "in_progress", "snoozed", "dismissed", "completed"].map(
          (value) => (
            <option key={value} value={value}>
              {value.replaceAll("_", " ")}
            </option>
          ),
        )}
      </select>
      <label htmlFor="workflow-priority">
        Priority (manual ordering, no revenue estimate)
      </label>
      <select
        id="workflow-priority"
        name="priority"
        defaultValue={item.priority}
      >
        <option value="1">High</option>
        <option value="2">Medium</option>
        <option value="3">Low</option>
      </select>
      <label htmlFor="workflow-assignee">Assignee</label>
      <select
        id="workflow-assignee"
        name="assignee"
        defaultValue={item.assignee_id ?? ""}
      >
        <option value="">Unassigned</option>
        {assignees.map((person) => (
          <option key={person.user_id} value={person.user_id}>
            {person.email}
          </option>
        ))}
        {item.assignee_id &&
        !assignees.some((person) => person.user_id === item.assignee_id) ? (
          <option value={item.assignee_id}>
            Keep current assignee ({item.assignee_id})
          </option>
        ) : null}
      </select>
      <label htmlFor="workflow-snooze">
        Snooze until (ISO time, e.g. 2027-01-01T09:00:00Z)
      </label>
      <input
        id="workflow-snooze"
        name="snooze"
        defaultValue={item.snooze_until ?? ""}
      />
      <label htmlFor="workflow-reason">
        Decision reason (required for dismissal)
      </label>
      <textarea
        id="workflow-reason"
        name="reason"
        maxLength={2000}
        defaultValue={item.decision_reason ?? ""}
      />
      <button className="button primary" disabled={pending}>
        {pending ? "Saving…" : "Update workflow"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function CommentForm({ item }: { item: Opportunity }) {
  const [state, action, pending] = useActionState(commentOpportunity, {
    error: "",
  });
  return (
    <form action={action} className="auth-form">
      <Target item={item} />
      <label htmlFor="comment-body">Add a comment</label>
      <textarea id="comment-body" name="body" required maxLength={4000} />
      <button className="button outline" disabled={pending}>
        Save comment
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function EvidenceReviewForm({ item }: { item: Opportunity }) {
  const [state, action, pending] = useActionState(refreshEvidence, {
    error: "",
  });
  return (
    <form action={action} className="auth-form">
      <Target item={item} />
      <label className="checkbox-label">
        <input type="checkbox" name="confirm" required />I reviewed the current
        approved fact and this recommendation still follows from it.
      </label>
      <button className="button outline" disabled={pending}>
        Record evidence review
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function ReportForm({
  brandId,
  requestId,
}: {
  brandId: string;
  requestId: string;
}) {
  const [state, action, pending] = useActionState(createReport, { error: "" });
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="requestId" value={requestId} />
      <label htmlFor="report-title">Report title</label>
      <input id="report-title" name="title" required maxLength={180} />
      <label htmlFor="report-start">Report date range, from</label>
      <input id="report-start" name="start" type="date" required />
      <label htmlFor="report-end">Through (inclusive)</label>
      <input id="report-end" name="end" type="date" required />
      <label htmlFor="report-note">Annotations and known gaps</label>
      <textarea id="report-note" name="annotation" maxLength={4000} />
      <p>
        Snapshot includes opportunities and research runs created within these
        UTC dates, and daily analytics within these provider-local dates.
        Supporting fact versions, workflow history and raw evidence are
        preserved. Missing measurements stay unavailable.
      </p>
      <button className="button primary" disabled={pending}>
        {pending ? "Creating snapshot…" : "Create immutable report"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
