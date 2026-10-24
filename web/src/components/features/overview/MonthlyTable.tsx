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
      <div className="space-y-2">
        <h2 className="text-lg font-medium">Monthly summary</h2>
        <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-8 text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">No transactions yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h2 className="text-lg font-medium">Monthly summary</h2>
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-card)] overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border-default)]">
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">Month</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-[var(--color-text-secondary)]">Income</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-[var(--color-text-secondary)]">Spending</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-[var(--color-text-secondary)]">Transfers</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-[var(--color-text-secondary)]">Card payments</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-[var(--color-text-secondary)]">Uncategorised</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-[var(--color-text-secondary)]">Outflow total</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-[var(--color-text-secondary)]">Card coverage</th>
            </tr>
          </thead>
          <tbody>
            {months.map((month, index) => (
              <tr key={month.month} className={index !== months.length - 1 ? "border-b border-[var(--color-border-default)]" : ""}>
                <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">{month.month}</td>
                <td className="px-4 py-3 text-sm text-right">
                  <Link
                    href={`/overview/transactions?month=${month.month}&bucket=income`}
                    className="text-[var(--color-text-link)] hover:text-[var(--color-text-link-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive-focus-ring)] rounded px-1"
                  >
                    {displaySAR(month.income.total)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <Link
                    href={`/overview/transactions?month=${month.month}&bucket=spending`}
                    className="text-[var(--color-text-link)] hover:text-[var(--color-text-link-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive-focus-ring)] rounded px-1"
                  >
                    {displaySAR(month.spending.total)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <Link
                    href={`/overview/transactions?month=${month.month}&bucket=transfers`}
                    className="text-[var(--color-text-link)] hover:text-[var(--color-text-link-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive-focus-ring)] rounded px-1"
                  >
                    {displaySAR(month.transfers.total)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <Link
                    href={`/overview/transactions?month=${month.month}&bucket=card_payments`}
                    className="text-[var(--color-text-link)] hover:text-[var(--color-text-link-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive-focus-ring)] rounded px-1"
                  >
                    {displaySAR(month.card_payments)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <Link
                    href={`/overview/transactions?month=${month.month}&bucket=uncategorised`}
                    className="text-[var(--color-text-link)] hover:text-[var(--color-text-link-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive-focus-ring)] rounded px-1"
                  >
                    {displaySAR(month.uncategorised_spending)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <Link
                    href={`/overview/transactions?month=${month.month}&bucket=all`}
                    className="text-[var(--color-text-link)] hover:text-[var(--color-text-link-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-interactive-focus-ring)] rounded px-1"
                  >
                    {displaySAR(month.outflow_total)}
                  </Link>
                </td>
                <td className="px-4 py-3 text-sm text-right text-[var(--color-text-primary)]">
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
