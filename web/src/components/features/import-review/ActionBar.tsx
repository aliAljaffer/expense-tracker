/**
 * Sticky action bar for commit and cancel.
 * Displays the count of selected rows and provides commit/cancel buttons.
 */

interface ActionBarProps {
  selectedCount: number;
  totalCount: number;
  isCommitting: boolean;
  isCancelling: boolean;
  onCommit: () => void;
  onCancel: () => void;
}

export function ActionBar({
  selectedCount,
  totalCount,
  isCommitting,
  isCancelling,
  onCommit,
  onCancel,
}: ActionBarProps) {
  const isDisabled = selectedCount === 0;

  return (
    <div className="import-action-bar">
      <div className="import-action-bar__content">
        <div className="import-action-bar__info">
          <span className="import-action-bar__count">
            {selectedCount} of {totalCount} rows selected
          </span>
        </div>
        <div className="import-action-bar__actions">
          <button
            onClick={onCommit}
            disabled={isDisabled || isCommitting || isCancelling}
            className="btn btn--primary"
            title={isDisabled ? "Select at least one row to commit" : ""}
          >
            {isCommitting ? "Committing..." : `Commit ${selectedCount}`}
          </button>
          <button
            onClick={onCancel}
            disabled={isCommitting || isCancelling}
            className="btn btn--secondary"
          >
            {isCancelling ? "Cancelling..." : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}
