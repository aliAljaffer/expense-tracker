"use client";

/**
 * Table of parsed transaction rows with selection checkboxes.
 * Held rows (duplicate/anomaly score 8+) are unchecked by default but can be selected.
 */

import { displaySAR } from "@/lib/api/types";
import type { ImportRow } from "@/lib/api/types";

interface RowsTableProps {
  rows: ImportRow[];
  selectedIds: Set<number>;
  onToggle: (index: number) => void;
}

/**
 * Build initial selected IDs from the default_selected flags.
 * Exact duplicates are never included, regardless of their flag.
 */
export function initialSelectedIds(rows: ImportRow[]): Set<number> {
  const selected = new Set<number>();
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row.default_selected !== false) {
      if (row.duplicate?.exact) {
        continue;
      }
      selected.add(i);
    }
  }
  return selected;
}

export function RowsTable({ rows, selectedIds, onToggle }: RowsTableProps) {
  return (
    <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border-default)]">
      <table className="w-full border-collapse text-[var(--text-sm)]">
        <caption className="sr-only">
          Imported transaction rows with selection and duplicate/anomaly scores.
        </caption>
        <thead>
          <tr className="border-b border-[var(--color-border-default)] bg-[var(--color-surface-sunken)]">
            <th
              scope="col"
              className="w-10 px-4 py-3 text-left font-[var(--weight-medium)] text-[var(--color-text-primary)]"
            >
              <span className="sr-only">Select or held for review</span>
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left font-[var(--weight-medium)] text-[var(--color-text-primary)]"
            >
              Date
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left font-[var(--weight-medium)] text-[var(--color-text-primary)]"
            >
              Description
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right font-[var(--weight-medium)] text-[var(--color-text-primary)]"
            >
              Debit
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right font-[var(--weight-medium)] text-[var(--color-text-primary)]"
            >
              Credit
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-right font-[var(--weight-medium)] text-[var(--color-text-primary)]"
            >
              Balance
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left font-[var(--weight-medium)] text-[var(--color-text-primary)]"
            >
              Duplicate
            </th>
            <th
              scope="col"
              className="px-4 py-3 text-left font-[var(--weight-medium)] text-[var(--color-text-primary)]"
            >
              Anomaly
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isExactDuplicate = row.duplicate?.exact === true;

            return (
              <tr
                key={index}
                className="border-b border-[var(--color-border-default)] hover:bg-[var(--color-surface-sunken)]"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(index)}
                      onChange={() => onToggle(index)}
                      disabled={isExactDuplicate}
                      className="h-4 w-4 rounded border-[var(--color-border-default)] accent-[var(--color-action-primary)] disabled:opacity-50"
                      aria-label={`Select row ${index + 1}${isExactDuplicate ? ', already imported' : ''}`}
                      aria-describedby={isExactDuplicate ? `exact-dup-${index}` : undefined}
                    />
                    {isExactDuplicate && (
                      <span
                        id={`exact-dup-${index}`}
                        className="text-[var(--text-xs)] text-[var(--color-text-tertiary)] whitespace-nowrap"
                      >
                        Already imported
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-[var(--color-text-primary)]">
                  {row.posted_date}
                </td>
                <td
                  className="max-w-xs px-4 py-3 text-[var(--color-text-primary)]"
                  dir="auto"
                >
                  {row.description_raw}
                </td>
                <td className="px-4 py-3 text-right text-[var(--color-text-primary)]">
                  {row.debit > 0 ? displaySAR(row.debit) : ""}
                </td>
                <td className="px-4 py-3 text-right text-[var(--color-text-primary)]">
                  {row.credit > 0 ? displaySAR(row.credit) : ""}
                </td>
                <td className="px-4 py-3 text-right text-[var(--color-text-primary)]">
                  {displaySAR(row.balance_after)}
                </td>
                <td className="px-4 py-3">
                  {row.duplicate ? (
                    <div>
                      <p className="text-[var(--text-xs)] font-[var(--weight-medium)] text-[var(--color-text-primary)]">
                        {row.duplicate.exact
                          ? "Exact"
                          : `Score ${row.duplicate.score}`}
                      </p>
                      <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                        {row.duplicate.reason}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[var(--text-xs)] text-[var(--color-text-tertiary)]">
                      No match
                    </p>
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.anomaly ? (
                    <div>
                      <p className="text-[var(--text-xs)] font-[var(--weight-medium)] text-[var(--color-text-primary)]">
                        Score {row.anomaly.score}
                      </p>
                      <p className="text-[var(--text-xs)] text-[var(--color-text-secondary)]">
                        {row.anomaly.reason}
                      </p>
                    </div>
                  ) : (
                    <p className="text-[var(--text-xs)] text-[var(--color-text-tertiary)]">
                      None
                    </p>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Marker row shown when a row is held for review.
 */
export function HeldRowMarker() {
  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-feedback-warning-border)] bg-[var(--color-feedback-warning-bg)] px-4 py-2">
      <svg
        className="h-4 w-4 text-[var(--color-feedback-warning-icon)]"
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
      <p className="text-[var(--text-sm)] font-[var(--weight-medium)] text-[var(--color-feedback-warning-text)]">
        Held for review
      </p>
    </div>
  );
}
