/**
 * Status banner: ready (can commit), rejected (reconciliation failed), or already imported.
 */

interface StatusBannerProps {
  variant: "ready" | "rejected" | "already_imported";
  showCommitControl?: boolean;
}

export function StatusBanner({
  variant,
  showCommitControl = false,
}: StatusBannerProps) {
  if (variant === "ready") {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-feedback-success-border)] bg-[var(--color-feedback-success-bg)] p-4">
        <div className="flex items-start gap-3">
          <svg
            className="h-5 w-5 flex-shrink-0 text-[var(--color-feedback-success-icon)] pt-0.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="text-[var(--text-sm)] font-[var(--weight-medium)] text-[var(--color-feedback-success-text)]">
              Ready to review
            </p>
            <p className="mt-1 text-[var(--text-sm)] text-[var(--color-feedback-success-text)]">
              All reconciliation checks passed.
              {showCommitControl &&
                " Select rows above and commit to import them."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "rejected") {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--color-feedback-error-border)] bg-[var(--color-feedback-error-bg)] p-4">
        <div className="flex items-start gap-3">
          <svg
            className="h-5 w-5 flex-shrink-0 text-[var(--color-feedback-error-icon)] pt-0.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            <p className="text-[var(--text-sm)] font-[var(--weight-medium)] text-[var(--color-feedback-error-text)]">
              Import rejected
            </p>
            <p className="mt-1 text-[var(--text-sm)] text-[var(--color-feedback-error-text)]">
              Reconciliation checks failed. This statement cannot be imported.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-feedback-warning-border)] bg-[var(--color-feedback-warning-bg)] p-4">
      <div className="flex items-start gap-3">
        <svg
          className="h-5 w-5 flex-shrink-0 text-[var(--color-feedback-warning-icon)] pt-0.5"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <p className="text-[var(--text-sm)] font-[var(--weight-medium)] text-[var(--color-feedback-warning-text)]">
            Already imported
          </p>
          <p className="mt-1 text-[var(--text-sm)] text-[var(--color-feedback-warning-text)]">
            This file has already been imported.
          </p>
        </div>
      </div>
    </div>
  );
}
