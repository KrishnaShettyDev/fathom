"use client";
import { useActionState } from "react";
import { authorizeGoogle } from "../lib/connectors/google-actions";
import {
  authorizeShopify,
  syncSource,
  setAllowance,
} from "../lib/connectors/actions";
import type { SourceFormState } from "../lib/sources/validation";
function Feedback({ state }: { state: SourceFormState }) {
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
export function AuthorizeShopifyForm({
  brandId,
  brandName,
  sourceId,
  shop,
  configured,
}: {
  brandId: string;
  brandName: string;
  sourceId: string;
  shop: string;
  configured: boolean;
}) {
  const [state, action, pending] = useActionState(authorizeShopify, {
    error: "",
  });
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="sourceId" value={sourceId} />
      <label className="checkbox-label">
        <input type="checkbox" name="confirm" required disabled={!configured} />
        Authorize read-only catalogue access for {shop} in {brandName}.
      </label>
      <button className="button primary" disabled={pending || !configured}>
        {pending
          ? "Opening Shopify…"
          : configured
            ? "Authorize with Shopify"
            : "Shopify configuration pending"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function SyncSourceForm({
  brandId,
  sourceId,
  requestId,
}: {
  brandId: string;
  sourceId: string;
  requestId: string;
}) {
  const [state, action, pending] = useActionState(syncSource, { error: "" });
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="sourceId" value={sourceId} />
      <input type="hidden" name="requestId" value={requestId} />
      <button className="button primary" disabled={pending}>
        {pending ? "Queuing…" : "Sync source"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
export function AllowanceForm({
  brandId,
  limit,
}: {
  brandId: string;
  limit: number;
}) {
  const [state, action, pending] = useActionState(setAllowance, { error: "" });
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={brandId} />
      <label htmlFor="collection-limit">
        Monthly collection run allowance (UTC calendar month)
      </label>
      <input
        id="collection-limit"
        name="limit"
        type="number"
        min={0}
        max={1000}
        required
        defaultValue={limit}
      />
      <p>
        Default: 20 runs. Catalogue runs are capped at 1,000 pages; analytics
        runs collect 28 days. Failed attempts retain their reservation; existing
        records remain readable at the limit. This is not a payment setting.
      </p>
      <button className="button outline" disabled={pending}>
        Save allowance
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function AuthorizeGoogleForm({
  brandId,
  brandName,
  sourceId,
  reference,
  configured,
}: {
  brandId: string;
  brandName: string;
  sourceId: string;
  reference: string;
  configured: boolean;
}) {
  const [state, action, pending] = useActionState(authorizeGoogle, {
    error: "",
  });
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="brandId" value={brandId} />
      <input type="hidden" name="sourceId" value={sourceId} />
      <label className="checkbox-label">
        <input type="checkbox" name="confirm" required disabled={!configured} />
        Authorize read-only access to exactly {reference} for {brandName}. No
        other property will be selected.
      </label>
      <button className="button primary" disabled={pending || !configured}>
        {pending
          ? "Opening Google…"
          : configured
            ? "Authorize with Google"
            : "Google configuration pending"}
      </button>
      <Feedback state={state} />
    </form>
  );
}
