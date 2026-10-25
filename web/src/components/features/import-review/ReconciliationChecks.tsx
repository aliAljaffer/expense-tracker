"use client";

/**
 * Reconciliation checks: pass or fail status with icon and description.
 * Collapsible when all checks pass.
 */

import { useState } from "react";
import type { Reconciliation } from "@/lib/api/types";

interface ReconciliationChecksProps {
  reconciliation: Reconciliation;
}

export function ReconciliationChecks({
  reconciliation,
}: ReconciliationChecksProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const allPassed = reconciliation.checks.every((check) => check.status === "pass");
  const failedChecks = reconciliation.checks.filter((check) => check.status !== "pass");

  if (allPassed) {
    return (
      <div className="stack--snug">
        <details
          className="reconciliation-summary"
          open={isExpanded}
          onToggle={(e) => setIsExpanded(e.currentTarget.open)}
        >
          <summary className="reconciliation-summary__trigger">
            <span className="reconciliation-summary__icon">
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
            </span>
            <span className="reconciliation-summary__text">
              All {reconciliation.checks.length} reconciliation checks passed
            </span>
          </summary>
          <div className="reconciliation-summary__details">
            {reconciliation.checks.map((check) => (
              <div
                key={check.name}
                className="import-check border rounded-md border-success bg-feedback-success"
              >
                <div className="import-check__icon pt-0-5 flex-shrink-0 text-[var(--color-feedback-success-icon)]">
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
                </div>
                <div className="import-check__body flex-1">
                  <p className="import-check__name text-sm font-medium text-feedback-success">
                    {check.name.replace(/_/g, " ").replace(/\b\w/g, (l) =>
                      l.toUpperCase()
                    )}
                  </p>
                  <p className="import-check__detail text-xs text-feedback-success">
                    Parsed: {check.parsed} | Stated: {check.stated}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="stack--snug">
      {failedChecks.map((check) => (
        <div
          key={check.name}
          className="import-check border rounded-md border-error bg-feedback-error"
        >
          <div className="import-check__icon pt-0-5 flex-shrink-0 text-[var(--color-feedback-error-icon)]">
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
          </div>
          <div className="import-check__body flex-1">
            <p className="import-check__name text-sm font-medium text-feedback-error">
              {check.name.replace(/_/g, " ").replace(/\b\w/g, (l) =>
                l.toUpperCase()
              )}
            </p>
            <p className="import-check__detail text-xs text-feedback-error">
              Parsed: {check.parsed} | Stated: {check.stated}
            </p>
          </div>
        </div>
      ))}
      {reconciliation.checks.filter((c) => c.status === "pass").length > 0 && (
        <div className="stack--snug">
          <details className="reconciliation-summary" open={false}>
            <summary className="reconciliation-summary__trigger">
              <span className="reconciliation-summary__icon">
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
              </span>
              <span className="reconciliation-summary__text">
                {reconciliation.checks.filter((c) => c.status === "pass").length} passing checks
              </span>
            </summary>
            <div className="reconciliation-summary__details">
              {reconciliation.checks
                .filter((c) => c.status === "pass")
                .map((check) => (
                  <div
                    key={check.name}
                    className="import-check border rounded-md border-success bg-feedback-success"
                  >
                    <div className="import-check__icon pt-0-5 flex-shrink-0 text-[var(--color-feedback-success-icon)]">
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
                    </div>
                    <div className="import-check__body flex-1">
                      <p className="import-check__name text-sm font-medium text-feedback-success">
                        {check.name.replace(/_/g, " ").replace(/\b\w/g, (l) =>
                          l.toUpperCase()
                        )}
                      </p>
                      <p className="import-check__detail text-xs text-feedback-success">
                        Parsed: {check.parsed} | Stated: {check.stated}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
