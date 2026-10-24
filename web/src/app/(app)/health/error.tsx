"use client";

export default function HealthError({ reset }: { error: Error; reset: () => void }) {
  return (
    <>
      <div className="page__intro">
        <p className="eyebrow">Error</p>
        <h1 className="display">This page did not load.</h1>
        <p className="lede">The server did not return the readiness checks. Try again.</p>
      </div>
      <div className="panel__actions">
        <button type="button" className="button button--primary" onClick={reset}>
          Try again
        </button>
      </div>
    </>
  );
}
