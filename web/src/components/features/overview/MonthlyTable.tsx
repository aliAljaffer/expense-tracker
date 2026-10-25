"use client";

import Link from "next/link";
import { displaySAR } from "@/lib/api/types";
import type { MonthlyOverview } from "@/lib/api/types";

interface MonthlyTableProps {
  months: MonthlyOverview[];
}

export function MonthlyTable({ months }: MonthlyTableProps) {
  if (months.length === 0) {
    return (
      <div className="overview-section">
        <h2 className="overview-section__title">Monthly summary</h2>
        <div className="overview-empty-state">
          <p className="overview-empty-state__text">No transactions yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overview-section">
      <h2 className="overview-section__title">Monthly summary</h2>
      <p className="overview-table-hint">Scroll to see all columns</p>
      <div
        className="overview-table-wrapper"
        role="region"
        aria-label="Monthly summary table"
        tabIndex={0}
      >
        <table className="overview-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Income</th>
              <th>Spending</th>
              <th>Transfers</th>
              <th>Card payments</th>
              <th>Uncategorised</th>
              <th>Outflow total</th>
              <th>Card coverage</th>
            </tr>
          </thead>
          <tbody>
            {months.map((month) => (
              <tr key={month.month}>
                <td>{month.month}</td>
                <td>
                  <Link
                    href={`/overview/transactions?month=${month.month}&bucket=income`}
                    className="overview-table__link"
                  >
                    {displaySAR(month.income.total)}
                  </Link>
                </td>
                <td>
                  <Link
                    href={`/overview/transactions?month=${month.month}&bucket=spending`}
                    className="overview-table__link"
                  >
                    {displaySAR(month.spending.total)}
                  </Link>
                </td>
                <td>
                  <Link
                    href={`/overview/transactions?month=${month.month}&bucket=transfers`}
                    className="overview-table__link"
                  >
                    {displaySAR(month.transfers.total)}
                  </Link>
                </td>
                <td>
                  <Link
                    href={`/overview/transactions?month=${month.month}&bucket=card_payments`}
                    className="overview-table__link"
                  >
                    {displaySAR(month.card_payments)}
                  </Link>
                </td>
                <td>
                  <Link
                    href={`/overview/transactions?month=${month.month}&bucket=uncategorised`}
                    className="overview-table__link"
                  >
                    {displaySAR(month.uncategorised_spending)}
                  </Link>
                </td>
                <td>
                  <Link
                    href={`/overview/transactions?month=${month.month}&bucket=all`}
                    className="overview-table__link"
                  >
                    {displaySAR(month.outflow_total)}
                  </Link>
                </td>
                <td>
                  {(month.credit_card_coverage.uncovered_share * 100).toFixed(0)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
