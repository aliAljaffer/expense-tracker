"use client";

export default function TransactionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-medium">Transactions</h1>
      </div>

      <div className="rounded-lg border border-[var(--color-feedback-error-border)] bg-[var(--color-feedback-error-bg)] p-6">
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0 text-[var(--color-feedback-error-icon)]">
              <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-medium text-[var(--color-feedback-error-text)]">Something went wrong</h2>
              <p className="mt-1 text-sm text-[var(--color-feedback-error-text)]">
                {error.message || "An error occurred while loading transactions."}
              </p>
            </div>
          </div>

          <button
            onClick={reset}
            className="inline-block px-4 py-2 rounded-md bg-[var(--color-action-primary)] text-[var(--color-text-on-action)] hover:bg-[var(--color-action-primary-hover)] active:bg-[var(--color-action-primary-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive-focus-ring)]"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
