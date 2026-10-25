"use client";

import Link from "next/link";
import { displaySAR } from "@/lib/api/types";
import type { RecurringResponse } from "@/lib/api/types";

interface RecurringPaymentsCardProps {
  data: RecurringResponse;
  lead?: boolean;
}

export function RecurringPaymentsCard({ data, lead = false }: RecurringPaymentsCardProps) {
  if (data.status === "insufficient_data") {
    return (
      <div className="suggestion-card suggestion-card--insufficient-data">
        <div className="suggestion-card__header">
          <h3 className="suggestion-card__title">Recurring payments</h3>
          <p className="suggestion-card__summary">
            Not enough data yet. Continue importing statements to detect patterns.
          </p>
          <p className="suggestion-insufficient-data__reason">{data.next_step}</p>
        </div>
      </div>
    );
  }

  const series = data.evidence.recurring_series;

  return (
    <div className={`suggestion-card${lead ? " suggestion-card--lead" : ""}`}>
      <div className="suggestion-card__header">
        <h3 className="suggestion-card__title">Recurring payments</h3>
        <p className="suggestion-card__summary">{data.summary}</p>
      </div>

      <div className="suggestion-card__body">
        <div className="suggestion-card__period">
          Period: {data.period.from} to {data.period.to}
        </div>

        {series.length > 0 && (
          <div className="suggestion-card__table-wrapper">
            <table className="suggestion-card__table">
              <thead>
                <tr>
                  <th>Merchant</th>
                  <th>Count</th>
                  <th>Median</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {series.map((s) => (
                  <tr key={s.merchant_id}>
                    <td>
                      <Link
                        href={`/overview/transactions?merchant=${s.merchant_id}&from=${s.first_date}&to=${s.last_date}`}
                        className="suggestion-card__link"
                      >
                        {s.merchant}
                      </Link>
                    </td>
                    <td>
                      {s.occurrence_count}
                    </td>
                    <td>
                      {displaySAR(s.median_amount)}
                    </td>
                    <td>
                      {displaySAR(s.total_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="suggestion-card__footer">
          <div className="suggestion-card__footer-section">
            <p className="suggestion-card__footer-label">Limits</p>
            <p className="suggestion-card__footer-text">{data.limits}</p>
          </div>
          <div className="suggestion-card__footer-section">
            <p className="suggestion-card__footer-label">Next step</p>
            <p className="suggestion-card__footer-text">{data.next_step}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
