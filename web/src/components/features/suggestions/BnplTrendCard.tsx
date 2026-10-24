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
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-6">
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-[var(--color-text-primary)]">BNPL trend</h3>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              No BNPL commitments yet. Mark merchants as BNPL to track obligations.
            </p>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)]">{data.next_step}</p>
        </div>
      </div>
    );
  }

  const months = data.evidence.months;

  return (
    <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-6">
      <div className="space-y-4">
        <div>
          <h3 className="font-medium text-[var(--color-text-primary)]">BNPL trend</h3>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{data.summary}</p>
        </div>

        <div className="text-xs text-[var(--color-text-secondary)]">
          Period: {data.period.from} to {data.period.to}
        </div>

        {months.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border-default)]">
                  <th className="px-3 py-2 text-left text-xs font-medium text-[var(--color-text-secondary)]">Month</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[var(--color-text-secondary)]">Outflow</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[var(--color-text-secondary)]">Prev</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-[var(--color-text-secondary)]">3-mo avg</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-[var(--color-text-secondary)]">Status</th>
                </tr>
              </thead>
              <tbody>
                {months.map((month, idx) => (
                  <tr key={month.month} className={idx !== months.length - 1 ? "border-b border-[var(--color-border-default)]" : ""}>
                    <td className="px-3 py-2 text-[var(--color-text-primary)]">
                      <Link
                        href={`/overview/transactions?from=${month.month}-01&to=${month.month}-31`}
                        className="text-[var(--color-action-primary)] hover:text-[var(--color-action-primary-hover)] underline"
                      >
                        {month.month}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-primary)]">
                      {displaySAR(month.bnpl_outflow)}
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-primary)]">
                      {displaySAR(month.previous_month)}
                    </td>
                    <td className="px-3 py-2 text-right text-[var(--color-text-primary)]">
                      {displaySAR(month.three_month_average)}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-[var(--color-text-secondary)]">
                      {month.is_rising ? "Rising" : "Normal"}
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
