"use client";

/**
 * Table of parsed transaction rows with selection checkboxes.
 * Held rows (duplicate/anomaly score 8+) are unchecked by default but can be selected.
 */

import { displaySAR } from "@/lib/api/types";
import type { ImportRow } from "@/lib/api/types";
import { Checkbox } from "@/components/ui/headless-checkbox";

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

/**
 * Marker for held rows (duplicates or high anomaly scores).
 */
export function HeldRowMarker() {
  return (
    <span className="import-row-marker">
      Held for review
    </span>
  );
}

export function RowsTable({ rows, selectedIds, onToggle }: RowsTableProps) {
  return (
    <div className="table__wrap">
      <table className="table">
        <caption className="sr-only">
          Imported transaction rows with selection and duplicate/anomaly scores.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="w-10">
              <span className="sr-only">Select or held for review</span>
            </th>
            <th scope="col">Date</th>
            <th scope="col">Description</th>
            <th scope="col">Debit</th>
            <th scope="col">Credit</th>
            <th scope="col">Balance</th>
            <th scope="col">Duplicate</th>
            <th scope="col">Anomaly</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const isExactDuplicate = row.duplicate?.exact === true;
            const dateStr = row.posted_date;
            const descStr = row.description_raw;

            return (
              <tr key={index}>
                <td>
                  <div className="cluster--snug">
                    <Checkbox
                      checked={selectedIds.has(index)}
                      onChange={() => {
                        if (!isExactDuplicate) {
                          onToggle(index);
                        }
                      }}
                      disabled={isExactDuplicate}
                      label=""
                      ariaLabel={`Select row ${dateStr} ${descStr}${isExactDuplicate ? ", Already imported" : ""}`}
                    />
                    {isExactDuplicate && (
                      <span className="import-row-marker">
                        Already imported
                      </span>
                    )}
                  </div>
                </td>
                <td className="text-sm text-primary whitespace-nowrap">
                  {row.posted_date}
                </td>
                <td className="text-sm text-primary max-w-xs" dir="auto">
                  {row.description_raw}
                </td>
                <td className="text-sm text-primary text-right">
                  {row.debit > 0 ? displaySAR(row.debit) : ""}
                </td>
                <td className="text-sm text-primary text-right">
                  {row.credit > 0 ? displaySAR(row.credit) : ""}
                </td>
                <td className="text-sm text-primary text-right">
                  {displaySAR(row.balance_after)}
                </td>
                <td className="text-sm text-primary">
                  {row.duplicate ? (
                    <div>
                      <p className="text-xs font-medium text-primary">
                        {row.duplicate.exact
                          ? "Exact"
                          : `Score ${row.duplicate.score}`}
                      </p>
                      <p className="text-xs text-secondary">
                        {row.duplicate.reason}
                      </p>
                    </div>
                  ) : (
                    ""
                  )}
                </td>
                <td className="text-sm text-primary">
                  {row.anomaly ? (
                    <div>
                      <p className="text-xs font-medium text-primary">
                        Score {row.anomaly.score}
                      </p>
                      <p className="text-xs text-secondary">
                        {row.anomaly.reason}
                      </p>
                    </div>
                  ) : (
                    ""
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
