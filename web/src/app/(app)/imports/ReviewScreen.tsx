"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { type ImportPreview } from "@/lib/api/types";
import { HeaderFigures } from "@/components/features/import-review/HeaderFigures";
import { ReconciliationChecks } from "@/components/features/import-review/ReconciliationChecks";
import { RowsTable, initialSelectedIds } from "@/components/features/import-review/RowsTable";
import { AnomalyNotice } from "@/components/features/import-review/AnomalyNotice";
import { StatusBanner } from "@/components/features/import-review/StatusBanner";
import { commitImport, cancelImport } from "./actions";

interface ReviewScreenProps {
  preview: ImportPreview;
}

export function ReviewScreen({ preview }: ReviewScreenProps) {
  const router = useRouter();
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

  function handleToggle(index: number) {
    const newIds = new Set(selectedIds);
    if (newIds.has(index)) {
      newIds.delete(index);
    } else {
      newIds.add(index);
    }
    setSelectedIds(newIds);
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
        router.push("/imports");
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
      <div className="space-y-4 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-sunken)] p-6">
        <div className="space-y-2">
          <h2 className="text-lg font-medium">Import successful</h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {commitResult.inserted} row{commitResult.inserted === 1 ? "" : "s"} imported successfully.
          </p>
        </div>
        <button
          onClick={() => router.push("/imports")}
          className="inline-block px-4 py-2 rounded-md bg-[var(--color-action-primary)] text-[var(--color-text-on-action)] hover:bg-[var(--color-action-primary-hover)] active:bg-[var(--color-action-primary-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive-focus-ring)]"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-[var(--color-feedback-error-border)] bg-[var(--color-feedback-error-bg)] p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0 text-[var(--color-feedback-error-icon)]">
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="text-sm text-[var(--color-feedback-error-text)]">{error}</div>
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
        <StatusBanner variant="ready" showCommitControl={true} />
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Statement details</h2>
        <HeaderFigures header={preview.header} />
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-medium">Reconciliation</h2>
        <ReconciliationChecks reconciliation={preview.reconciliation} />
      </div>

      {preview.rows && preview.rows.length > 0 && (
        <>
          <AnomalyNotice
            anomalyReady={preview.summary.anomaly_ready}
            historyRows={preview.summary.history_rows}
          />

          <div className="space-y-4">
            <h2 className="text-lg font-medium">Transactions</h2>
            <RowsTable
              rows={preview.rows}
              selectedIds={selectedIds}
              onToggle={handleToggle}
            />
          </div>
        </>
      )}

      {canShowCommit && (
        <div className="flex gap-3">
          <button
            onClick={handleCommit}
            disabled={isCommitting || isCancelling}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              isCommitting || isCancelling
                ? "bg-[var(--color-surface-disabled)] text-[var(--color-text-disabled)] cursor-not-allowed"
                : "bg-[var(--color-action-primary)] text-[var(--color-text-on-action)] hover:bg-[var(--color-action-primary-hover)] active:bg-[var(--color-action-primary-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive-focus-ring)]"
            }`}
          >
            {isCommitting ? "Committing..." : "Commit"}
          </button>
          <button
            onClick={handleCancel}
            disabled={isCommitting || isCancelling}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              isCommitting || isCancelling
                ? "bg-[var(--color-surface-disabled)] text-[var(--color-text-disabled)] cursor-not-allowed"
                : "bg-[var(--color-action-secondary)] text-[var(--color-text-on-dark)] hover:bg-[var(--color-action-secondary-hover)] active:bg-[var(--color-action-secondary-active)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive-focus-ring)]"
            }`}
          >
            {isCancelling ? "Cancelling..." : "Cancel"}
          </button>
        </div>
      )}
    </div>
  );
}
