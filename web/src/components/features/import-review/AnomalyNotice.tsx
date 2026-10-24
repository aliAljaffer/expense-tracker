/**
 * Anomaly notice: shows "not enough history yet" when anomaly scores are unavailable.
 */

interface AnomalyNoticeProps {
  anomalyReady: boolean;
  historyRows: number;
}

export function AnomalyNotice({
  anomalyReady,
  historyRows,
}: AnomalyNoticeProps) {
  if (anomalyReady) {
    return null;
  }

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-feedback-info-border)] bg-[var(--color-feedback-info-bg)] p-4">
      <div className="flex items-start gap-3">
        <svg
          className="h-5 w-5 flex-shrink-0 text-[var(--color-feedback-info-icon)] pt-0.5"
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
            clipRule="evenodd"
          />
        </svg>
        <div>
          <p className="text-[var(--text-sm)] font-[var(--weight-medium)] text-[var(--color-feedback-info-text)]">
            Not enough history yet
          </p>
          <p className="mt-1 text-[var(--text-sm)] text-[var(--color-feedback-info-text)]">
            Anomaly scoring needs at least 20 spending rows. This account has{" "}
            {historyRows}.
          </p>
        </div>
      </div>
    </div>
  );
}
