"use client";
import { useActionState } from "react";
import { saveFact, reviewFact } from "../../lib/knowledge/actions";
import { categories } from "../../lib/knowledge/validation";
import type { Database } from "../../lib/supabase/database.types";
type Fact = Database["public"]["Tables"]["brand_facts"]["Row"];
export function FactForm({
  brandId,
  requestId,
  fact,
}: {
  brandId: string;
  requestId: string;
  fact?: Fact;
}) {
  const [state, action, pending] = useActionState(saveFact, { error: "" });
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="factId" value={fact?.id ?? ""} />
      <input type="hidden" name="version" value={fact?.version ?? 0} />
      <input type="hidden" name="requestId" value={requestId} />
      <label htmlFor="fact-category">Category</label>
      <select
        id="fact-category"
        name="category"
        defaultValue={fact?.category ?? "product"}
      >
        {categories.map((category) => (
          <option value={category} key={category}>
            {category.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <label htmlFor="fact-statement">Fact or instruction</label>
      <textarea
        id="fact-statement"
        name="statement"
        rows={4}
        maxLength={4000}
        required
        defaultValue={fact?.statement}
      />
      <label htmlFor="fact-source">Source and supporting evidence</label>
      <textarea
        id="fact-source"
        name="source"
        rows={3}
        maxLength={2000}
        required
        defaultValue={fact?.source_description}
      />
      <label htmlFor="fact-url">Source URL (optional)</label>
      <input
        id="fact-url"
        name="sourceUrl"
        type="url"
        maxLength={2048}
        defaultValue={fact?.source_url ?? ""}
      />
      <label htmlFor="fact-owner">Responsible person or team</label>
      <input
        id="fact-owner"
        name="owner"
        maxLength={120}
        required
        defaultValue={fact?.responsible_owner}
      />
      <label htmlFor="fact-review">Review by (UTC date)</label>
      <input
        id="fact-review"
        name="reviewOn"
        type="date"
        required
        defaultValue={fact?.review_on}
      />
      <p className="muted">
        Saving creates a pending version. Review the source before approving it.
        Corrections remove previous approval.
      </p>
      <button className="button primary" disabled={pending}>
        {pending
          ? "Saving…"
          : fact
            ? "Save corrected version"
            : "Save pending fact"}
      </button>
      <p role="alert" className="form-error">
        {state.error}
      </p>
    </form>
  );
}
export function ReviewFactForm({
  fact,
  decision,
}: {
  fact: Fact;
  decision: "approved" | "archived";
}) {
  const [state, action, pending] = useActionState(reviewFact, { error: "" });
  const label = decision === "approved" ? "Approve" : "Archive";
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={fact.brand_id} />
      <input type="hidden" name="factId" value={fact.id} />
      <input type="hidden" name="version" value={fact.version} />
      <input type="hidden" name="decision" value={decision} />
      <label className="checkbox-label">
        <input type="checkbox" name="confirm" required />
        {label} version {fact.version} of this fact after reviewing its source.
      </label>
      <button className="button outline" disabled={pending}>
        {pending ? "Saving…" : `${label} version ${fact.version}`}
      </button>
      <p role="alert" className="form-error">
        {state.error}
      </p>
    </form>
  );
}
