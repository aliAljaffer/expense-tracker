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
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-6">
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-[var(--color-text-primary)]">Credit card coverage</h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Not enough data yet. Import card statements to see coverage.
            </p>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">{data.next_step}</p>
        </div>
      </div>
    );
  }

  const months = data.evidence.months;
  const uncoveredMonths = months.filter(m => m.uncovered > 0);

  return (
    <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-6">
      <div className="space-y-4">
        <div>
          <h3 className="font-medium text-[var(--color-text-primary)]">Credit card coverage</h3>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{data.summary}</p>
        </div>

        <div className="text-xs text-[var(--color-text-secondary)]">
          Period: {data.period.from} to {data.period.to}
        </div>

        {uncoveredMonths.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-default)]">
                  <th className="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)]">Month</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[var(--color-text-secondary)]">Payments</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[var(--color-text-secondary)]">Recorded</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[var(--color-text-secondary)]">Uncovered</th>
                </tr>
              </thead>
              <tbody>
                {uncoveredMonths.map((month, idx) => (
                  <tr key={month.month} className={idx !== uncoveredMonths.length - 1 ? "border-b border-[var(--color-border-default)]" : ""}>
                    <td className="px-3 py-2 text-[var(--color-text-primary)]">
                      <Link
                        href={`/overview/transactions?from=${month.month}-01&to=${month.month}-31&bucket=card_payments`}
                        className="text-[var(--color-action-primary)] hover:text-[var(--color-action-primary-hover)] underline"
                      >
                        {month.month}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-primary)]">
                      {displaySAR(month.card_payments)}
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-primary)]">
                      {displaySAR(month.purchases_recorded)}
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-primary)]">
                      {displaySAR(month.uncovered)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="space-y-3 bg-[var(--color-surface-sunken)] p-3 rounded text-xs">
          <div>
            <p className="font-medium text-[var(--color-text-secondary)]">Limits</p>
            <p className="mt-1 text-[var(--color-text-secondary)]">{data.limits}</p>
          </div>
          <div>
            <p className="font-medium text-[var(--color-text-secondary)]">Next step</p>
            <p className="mt-1 text-[var(--color-text-secondary)]">{data.next_step}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
