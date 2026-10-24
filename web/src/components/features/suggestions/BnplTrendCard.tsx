"use client";

import Link from "next/link";
import { displaySAR } from "@/lib/api/types";
import type { BnplResponse } from "@/lib/api/types";

interface BnplTrendCardProps {
  data: BnplResponse;
}

export function BnplTrendCard({ data }: BnplTrendCardProps) {
  if (data.status === "insufficient_data") {
    return (
      <div className="suggestion-card suggestion-card--insufficient-data">
        <div className="suggestion-card__header">
          <h3 className="suggestion-card__title">BNPL trend</h3>
          <p className="suggestion-card__summary">
            No BNPL commitments yet. Mark merchants as BNPL to track obligations.
          </p>
          <p className="suggestion-insufficient-data__reason">{data.next_step}</p>
        </div>
      </div>
    );
  }

  const months = data.evidence.months;

  return (
    <div className="suggestion-card">
      <div className="suggestion-card__header">
        <h3 className="suggestion-card__title">BNPL trend</h3>
        <p className="suggestion-card__summary">{data.summary}</p>
      </div>

      <div className="suggestion-card__body">
        <div className="suggestion-card__period">
          Period: {data.period.from} to {data.period.to}
        </div>

        {months.length > 0 && (
          <div className="suggestion-card__table-wrapper">
            <table className="suggestion-card__table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Outflow</th>
                  <th>Prev</th>
                  <th>3-mo avg</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {months.map((month) => (
                  <tr key={month.month}>
                    <td>
                      <Link
                        href={`/overview/transactions?from=${month.month}-01&to=${month.month}-31`}
                        className="suggestion-card__link"
                      >
                        {month.month}
                      </Link>
                    </td>
                    <td>
                      {displaySAR(month.bnpl_outflow)}
                    </td>
                    <td>
                      {displaySAR(month.previous_month)}
                    </td>
                    <td>
                      {displaySAR(month.three_month_average)}
                    </td>
                    <td>
                      {month.is_rising ? "Rising" : "Normal"}
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
