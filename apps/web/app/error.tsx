"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="eyebrow">TEMPORARILY UNAVAILABLE</span>
        <h1>
          We couldn’t load
          <br />
          <em>your workspace.</em>
        </h1>
        <p>
          The sign-in or database service may be unavailable. Your stored data
          has not been replaced or reset.
        </p>
        <button className="button primary" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}
