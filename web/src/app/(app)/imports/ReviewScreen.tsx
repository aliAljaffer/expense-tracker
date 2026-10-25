"use client";

import { useState } from "react";
import Link from "next/link";
import { type ImportPreview } from "@/lib/api/types";
import { HeaderFigures } from "@/components/features/import-review/HeaderFigures";
import { ReconciliationChecks } from "@/components/features/import-review/ReconciliationChecks";
import { RowsTable, initialSelectedIds } from "@/components/features/import-review/RowsTable";
import { AnomalyNotice } from "@/components/features/import-review/AnomalyNotice";
import { StatusBanner } from "@/components/features/import-review/StatusBanner";
import { ResumedBanner } from "@/components/features/import-review/ResumedBanner";
import { ActionBar } from "@/components/features/import-review/ActionBar";
import { commitImport, cancelImport } from "./actions";

interface ReviewScreenProps {
  preview: ImportPreview;
  onReset: () => void;
}

export function ReviewScreen({ preview, onReset }: ReviewScreenProps) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() =>
    initialSelectedIds(preview.rows || [])
  );
  const [isCommitting, setIsCommitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [commitResult, setCommitResult] = useState<{
    inserted: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isRejected = preview.status === "rejected";
  const isAlreadyImported = preview.already_imported;
  const canShowCommit = !isRejected && !isAlreadyImported;
  const selectedCount = selectedIds.size;
  const rowCount = preview.rows?.length || 0;

  function handleToggle(index: number) {
    const newIds = new Set(selectedIds);
    if (newIds.has(index)) {
      newIds.delete(index);
    } else {
      newIds.add(index);
    }
    setSelectedIds(newIds);
  }

  function handleSelectAllRows(indices: number[]) {
    setSelectedIds(new Set(indices));
  }

  function handlePageSelectionChange(indices: number[], select: boolean) {
    const newIds = new Set(selectedIds);
    indices.forEach((index) => (select ? newIds.add(index) : newIds.delete(index)));
    setSelectedIds(newIds);
  }

  function handleClearSelection() {
    setSelectedIds(new Set());
  }

  async function handleCommit() {
    setIsCommitting(true);
    setError(null);
    try {
      const selectedRowIds = Array.from(selectedIds);
      const result = await commitImport(preview.import_id, selectedRowIds);

      if ("error" in result) {
        setError(result.error);
      } else {
        setCommitResult({ inserted: result.inserted });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Commit failed";
      setError(message);
    } finally {
      setIsCommitting(false);
    }
  }

  async function handleCancel() {
    setIsCancelling(true);
    setError(null);
    try {
      const result = await cancelImport(preview.import_id);

      if ("error" in result) {
        setError(result.error);
      } else {
        onReset();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Cancel failed";
      setError(message);
    } finally {
      setIsCancelling(false);
    }
  }

  if (commitResult) {
    return (
      <div className="card">
        <div className="stack--snug">
          <div>
            <h2 className="section__title">Import successful</h2>
            <p className="note">
              {commitResult.inserted} row{commitResult.inserted === 1 ? "" : "s"} imported successfully.
            </p>
          </div>
          <div className="cluster--normal">
            <Link href="/overview" className="btn btn--primary">
              View overview
            </Link>
            <button
              onClick={onReset}
              className="btn btn--secondary"
            >
              Import another statement
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack--loose">
      {error && (
        <div className="banner banner--error">
          <svg className="banner__icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <div className="banner__content">
            <p className="banner__text">{error}</p>
          </div>
        </div>
      )}

      {isAlreadyImported && (
        <StatusBanner variant="already_imported" />
      )}

      {isRejected && (
        <StatusBanner variant="rejected" />
      )}

      {!isRejected && !isAlreadyImported && (
        <StatusBanner variant="ready" showCommitControl={false} />
      )}

      {preview.resumed && (
        <ResumedBanner />
      )}

      {canShowCommit && (
        <ActionBar
          selectedCount={selectedCount}
          totalCount={rowCount}
          isCommitting={isCommitting}
          isCancelling={isCancelling}
          onCommit={handleCommit}
          onCancel={handleCancel}
        />
      )}

      <div className="stack--snug">
        <h2 className="section__title">Statement details</h2>
        <HeaderFigures header={preview.header} />
      </div>

      <div className="stack--snug">
        <h2 className="section__title">Reconciliation</h2>
        <ReconciliationChecks reconciliation={preview.reconciliation} />
      </div>

      {preview.rows && preview.rows.length > 0 && (
        <>
          <AnomalyNotice
            anomalyReady={preview.summary.anomaly_ready}
            historyRows={preview.summary.history_rows}
          />

          <div className="stack--snug">
            <h2 className="section__title">Transactions</h2>
            <RowsTable
              rows={preview.rows}
              selectedIds={selectedIds}
              onToggle={handleToggle}
              onPageSelectionChange={handlePageSelectionChange}
              onSelectAllRows={handleSelectAllRows}
              onClearSelection={handleClearSelection}
              enablePagination={true}
            />
          </div>
        </>
      )}
    </div>
  );
}
