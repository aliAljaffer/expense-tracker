"use client";

import Link from "next/link";
import { displaySAR } from "@/lib/api/types";
import type { CardCoverageResponse } from "@/lib/api/types";

interface CreditCardCoverageCardProps {
  data: CardCoverageResponse;
}

export function CreditCardCoverageCard({ data }: CreditCardCoverageCardProps) {
  if (data.status === "insufficient_data") {
    return (
      <div className="suggestion-card suggestion-card--insufficient-data">
        <div className="suggestion-card__header">
          <h3 className="suggestion-card__title">Credit card coverage</h3>
          <p className="suggestion-card__summary">
            Not enough data yet. Import card statements to see coverage.
          </p>
          <p className="suggestion-insufficient-data__reason">{data.next_step}</p>
        </div>
      </div>
    );
  }

  const months = data.evidence.months;
  const uncoveredMonths = months.filter(m => m.uncovered > 0);

  return (
    <div className="suggestion-card">
      <div className="suggestion-card__header">
        <h3 className="suggestion-card__title">Credit card coverage</h3>
        <p className="suggestion-card__summary">{data.summary}</p>
      </div>

      <div className="suggestion-card__body">
        <div className="suggestion-card__period">
          Period: {data.period.from} to {data.period.to}
        </div>

        {uncoveredMonths.length > 0 && (
          <div className="suggestion-card__table-wrapper">
            <table className="suggestion-card__table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Payments</th>
                  <th>Recorded</th>
                  <th>Uncovered</th>
                </tr>
              </thead>
              <tbody>
                {uncoveredMonths.map((month) => (
                  <tr key={month.month}>
                    <td>
                      <Link
                        href={`/overview/transactions?from=${month.month}-01&to=${month.month}-31&bucket=card_payments`}
                        className="suggestion-card__link"
                      >
                        {month.month}
                      </Link>
                    </td>
                    <td>
                      {displaySAR(month.card_payments)}
                    </td>
                    <td>
                      {displaySAR(month.purchases_recorded)}
                    </td>
                    <td>
                      {displaySAR(month.uncovered)}
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
