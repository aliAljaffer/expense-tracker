"use client";

/**
 * Table of parsed transaction rows with selection checkboxes.
 * Held rows (duplicate/anomaly score 8+) are unchecked by default but can be selected.
 * Supports pagination with sortable rows.
 */

import { useState } from "react";
import { displaySAR } from "@/lib/api/types";
import type { ImportRow } from "@/lib/api/types";
import { Checkbox } from "@/components/ui/headless-checkbox";
import { Pagination } from "@/components/ui/pagination";
import { calculatePagination, DEFAULT_PER_PAGE, PER_PAGE_OPTIONS } from "@/lib/pagination";

interface RowsTableProps {
  rows: ImportRow[];
  selectedIds: Set<number>;
  onToggle: (index: number) => void;
  onSelectAllPage?: (indices: number[]) => void;
  onSelectAllRows?: (indices: number[]) => void;
  onClearSelection?: () => void;
  enablePagination?: boolean;
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

export function RowsTable({
  rows,
  selectedIds,
  onToggle,
  onSelectAllPage,
  onSelectAllRows,
  onClearSelection,
  enablePagination = false,
}: RowsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);

  const sortedIndices = Array.from({ length: rows.length }, (_, i) => i)
    .sort((a, b) => {
      const dateA = rows[a]?.posted_date || "";
      const dateB = rows[b]?.posted_date || "";
      if (dateB !== dateA) {
        return dateB.localeCompare(dateA);
      }
      return b - a;
    });

  const pagination = calculatePagination({
    total: sortedIndices.length,
    page: currentPage,
    perPage,
  });

  const pageStartIdx = enablePagination ? (pagination.clampedPage - 1) * perPage : 0;
  const pageEndIdx = enablePagination ? Math.min(pageStartIdx + perPage, sortedIndices.length) : sortedIndices.length;
  const pageIndices = sortedIndices.slice(pageStartIdx, pageEndIdx);

  const hasAnyDuplicates = rows.some((row) => row.duplicate !== null);
  const hasAnyAnomalies = rows.some((row) => row.anomaly !== null);

  const getSelectableIndicesOnPage = () => {
    return pageIndices.filter((idx) => !rows[idx]?.duplicate?.exact);
  };

  const pageSelectableIndices = getSelectableIndicesOnPage();
  const pageSelectedCount = pageSelectableIndices.filter((idx) =>
    selectedIds.has(idx)
  ).length;
  const isPageHeaderChecked =
    pageSelectableIndices.length > 0 &&
    pageSelectedCount === pageSelectableIndices.length;
  const isPageHeaderIndeterminate =
    pageSelectableIndices.length > 0 &&
    pageSelectedCount > 0 &&
    pageSelectedCount < pageSelectableIndices.length;

  const getAllSelectableIndices = () => {
    return sortedIndices.filter((idx) => !rows[idx]?.duplicate?.exact);
  };

  const handleSelectAllOnPage = () => {
    if (isPageHeaderChecked) {
      pageSelectableIndices.forEach((idx) => {
        if (selectedIds.has(idx)) {
          const newIds = new Set(selectedIds);
          newIds.delete(idx);
          selectedIds.clear();
          newIds.forEach((id) => selectedIds.add(id));
        }
      });
    } else {
      pageSelectableIndices.forEach((idx) => {
        if (!selectedIds.has(idx)) {
          selectedIds.add(idx);
        }
      });
    }
  };

  const handleSelectAllRows = () => {
    const allSelectable = getAllSelectableIndices();
    onSelectAllRows?.(allSelectable);
  };

  const handleClearSelection = () => {
    onClearSelection?.();
  };

  const handlePerPageChange = (newPerPage: number) => {
    setPerPage(newPerPage);
    setCurrentPage(1);
  };

  return (
    <div className="rows-table">
      {enablePagination && (
        <div className="rows-table__actions">
          <div className="rows-table__action-group">
            <button
              onClick={handleSelectAllRows}
              className="btn btn--secondary btn--sm"
              title={`Select all ${sortedIndices.length} rows`}
            >
              Select all {sortedIndices.length}
            </button>
            <button
              onClick={handleClearSelection}
              className="btn btn--secondary btn--sm"
              title="Clear all selections"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      <div className="table__wrap">
        <table className="table">
          <caption className="sr-only">
            Imported transaction rows with selection and duplicate/anomaly scores.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="w-10">
                {enablePagination && (
                  <div className="table__header-checkbox">
                    <Checkbox
                      checked={isPageHeaderChecked}
                      onChange={() => handleSelectAllOnPage()}
                      label=""
                      ariaLabel={
                        isPageHeaderIndeterminate
                          ? "Select all rows on this page (some selected)"
                          : "Select all rows on this page"
                      }
                      indeterminate={isPageHeaderIndeterminate}
                    />
                  </div>
                )}
                <span className="sr-only">Select or held for review</span>
              </th>
              <th scope="col">Date</th>
              <th scope="col">Description</th>
              <th scope="col">Debit</th>
              <th scope="col">Credit</th>
              <th scope="col">Balance</th>
              {hasAnyDuplicates && <th scope="col">Duplicate</th>}
              {hasAnyAnomalies && <th scope="col">Anomaly</th>}
            </tr>
          </thead>
          <tbody>
            {pageIndices.map((originalIndex) => {
              const row = rows[originalIndex]!;
              const isExactDuplicate = row.duplicate?.exact === true;
              const dateStr = row.posted_date;
              const descStr = row.description_raw;

              return (
                <tr key={originalIndex}>
                  <td>
                    <div className="cluster--snug">
                      <Checkbox
                        checked={selectedIds.has(originalIndex)}
                        onChange={() => {
                          if (!isExactDuplicate) {
                            onToggle(originalIndex);
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
                  <td className="text-sm text-primary text-right table-cell--tabular">
                    {row.debit > 0 ? displaySAR(row.debit) : ""}
                  </td>
                  <td className="text-sm text-primary text-right table-cell--tabular">
                    {row.credit > 0 ? displaySAR(row.credit) : ""}
                  </td>
                  <td className="text-sm text-primary text-right table-cell--tabular">
                    {displaySAR(row.balance_after)}
                  </td>
                  {hasAnyDuplicates && (
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
                  )}
                  {hasAnyAnomalies && (
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
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {enablePagination && (
        <Pagination
          total={sortedIndices.length}
          page={pagination.clampedPage}
          perPage={perPage}
          perPageOptions={PER_PAGE_OPTIONS}
          onPageChange={setCurrentPage}
          onPerPageChange={handlePerPageChange}
        />
      )}
    </div>
  );
}
