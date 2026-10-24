/**
 * Reconciliation checks: pass or fail status with icon and description.
 */

import type { Reconciliation } from "@/lib/api/types";

interface ReconciliationChecksProps {
  reconciliation: Reconciliation;
}

export function ReconciliationChecks({
  reconciliation,
}: ReconciliationChecksProps) {
  return (
    <div className="space-y-2">
      {reconciliation.checks.map((check) => {
        const isPassed = check.status === "pass";
        const iconColor = isPassed
          ? "text-[var(--color-feedback-success-icon)]"
          : "text-[var(--color-feedback-error-icon)]";
        const bgColor = isPassed
          ? "bg-[var(--color-feedback-success-bg)]"
          : "bg-[var(--color-feedback-error-bg)]";

        return (
          <div
            key={check.name}
            className={`flex items-start gap-3 rounded-[var(--radius-md)] border p-3 ${bgColor} ${
              isPassed
                ? "border-[var(--color-feedback-success-border)]"
                : "border-[var(--color-feedback-error-border)]"
            }`}
          >
            <div className={`flex-shrink-0 pt-0.5 ${iconColor}`}>
              {isPassed ? (
                <svg
                  className="h-5 w-5"
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
              ) : (
                <svg
                  className="h-5 w-5"
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
              )}
            </div>
            <div className="flex-1">
              <p
                className={`text-[var(--text-sm)] font-[var(--weight-medium)] ${
                  isPassed
                    ? "text-[var(--color-feedback-success-text)]"
                    : "text-[var(--color-feedback-error-text)]"
                }`}
              >
                {check.name.replace(/_/g, " ").replace(/\b\w/g, (l) =>
                  l.toUpperCase()
                )}
              </p>
              <p
                className={`mt-1 text-[var(--text-xs)] ${
                  isPassed
                    ? "text-[var(--color-feedback-success-text)]"
                    : "text-[var(--color-feedback-error-text)]"
                }`}
              >
                Parsed: {check.parsed} | Stated: {check.stated}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
