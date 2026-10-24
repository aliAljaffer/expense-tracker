"use client";

import Link from "next/link";
import { displaySAR } from "@/lib/api/types";
import type { RecurringResponse } from "@/lib/api/types";

interface RecurringPaymentsCardProps {
  data: RecurringResponse;
}

export function RecurringPaymentsCard({ data }: RecurringPaymentsCardProps) {
  if (data.status === "insufficient_data") {
    return (
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-6">
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-[var(--color-text-primary)]">Recurring payments</h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Not enough data yet. Continue importing statements to detect patterns.
            </p>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">{data.next_step}</p>
        </div>
      </div>
    );
  }

  const series = data.evidence.recurring_series;

  return (
    <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-6">
      <div className="space-y-4">
        <div>
          <h3 className="font-medium text-[var(--color-text-primary)]">Recurring payments</h3>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{data.summary}</p>
        </div>

        <div className="text-xs text-[var(--color-text-secondary)]">
          Period: {data.period.from} to {data.period.to}
        </div>

        {series.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-default)]">
                  <th className="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)]">Merchant</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[var(--color-text-secondary)]">Count</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[var(--color-text-secondary)]">Median</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[var(--color-text-secondary)]">Total</th>
                </tr>
              </thead>
              <tbody>
                {series.map((s, idx) => (
                  <tr key={s.merchant_id} className={idx !== series.length - 1 ? "border-b border-[var(--color-border-default)]" : ""}>
                    <td className="px-3 py-2 text-[var(--color-text-primary)]">
                      <Link
                        href={`/overview/transactions?kind=&account_id=&bucket=all`}
                        className="text-[var(--color-action-primary)] hover:text-[var(--color-action-primary-hover)] underline"
                      >
                        {s.merchant}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-primary)]">
                      {s.occurrence_count}
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-primary)]">
                      {displaySAR(s.median_amount)}
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-primary)]">
                      {displaySAR(s.total_amount)}
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
