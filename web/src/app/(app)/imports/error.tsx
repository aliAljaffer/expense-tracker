"use client";

export default function ImportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="shell page">
      <h1 className="display">Import statement</h1>

      <div className="section">
        <div className="card">
          <div className="banner banner--error" style={{ margin: 0 }}>
            <svg className="banner__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="banner__content">
              <p className="banner__title">Something went wrong</p>
              <p className="banner__text">
                {error.message || "An error occurred while loading the import page."}
              </p>
            </div>
          </div>

          <button
            onClick={reset}
            className="btn btn--primary"
            style={{ marginTop: "var(--space-6)" }}
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
