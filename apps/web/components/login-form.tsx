"use client";
import { useActionState, useEffect, useState } from "react";
import { requestCode, verifyCode } from "../lib/auth/actions";
import type { FormState } from "../lib/auth/validation";
import { Icon } from "./icon";
const initial: FormState = { error: "" };
export function LoginForm() {
  const [request, send, pending] = useActionState(requestCode, initial);
  const [verification, verify, verifying] = useActionState(verifyCode, initial);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = request.sentAt
    ? Math.max(
        0,
        Math.ceil((request.sentAt + 60_000 - (now || request.sentAt)) / 1000),
      )
    : 0;
  return (
    <div className="auth-form">
      <form action={send}>
        <label htmlFor="email">Work email</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          placeholder="you@company.com"
        />
        <button
          className="button primary"
          type="submit"
          disabled={pending || remaining > 0}
        >
          {pending
            ? "Requesting code…"
            : remaining > 0
              ? `Request another code in ${remaining}s`
              : "Email me a sign-in code"}
          <Icon name="arrow" size={16} />
        </button>
        <p className="form-error" role="alert">
          {request.error}
        </p>
      </form>
      {request.email ? (
        <form action={verify} className="verify-form">
          <p role="status">
            Check {request.email} for your six-digit sign-in code.
          </p>
          <input type="hidden" name="email" value={request.email} />
          <label htmlFor="code">Sign-in code</label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            autoComplete="one-time-code"
            required
          />
          <button className="button primary" disabled={verifying}>
            {verifying ? "Verifying…" : "Sign in"}
            <Icon name="arrow" size={16} />
          </button>
          <p className="form-error" role="alert">
            {verification.error}
          </p>
        </form>
      ) : null}
    </div>
  );
}
