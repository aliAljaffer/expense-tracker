"use client";

import { useState, useEffect } from "react";
import { getAccounts, getMonthlyOverview } from "@/lib/api/overview";
import { type AccountsResponse, type MonthlyResponse } from "@/lib/api/types";
import { AccountsTable } from "./AccountsTable";
import { MonthlyTable } from "./MonthlyTable";

export function OverviewContent() {
  const [accounts, setAccounts] = useState<AccountsResponse | null>(null);
  const [monthly, setMonthly] = useState<MonthlyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        setError(null);

        const [accountsData, monthlyData] = await Promise.all([
          getAccounts(),
          getMonthlyOverview(),
        ]);

        setAccounts(accountsData);
        setMonthly(monthlyData);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load overview";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  if (isLoading) {
    return <div className="space-y-6">Loading...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--color-feedback-error-border)] bg-[var(--color-feedback-error-bg)] p-6">
        <div className="flex gap-3">
          <div className="flex-shrink-0 text-[var(--color-feedback-error-icon)]">
            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h2 className="font-medium text-[var(--color-feedback-error-text)]">Failed to load overview</h2>
            <p className="mt-1 text-sm text-[var(--color-feedback-error-text)]">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!accounts || !monthly) {
    return null;
  }

  if (accounts.accounts.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-8 text-center">
        <h2 className="font-medium text-[var(--color-text-primary)]">No accounts yet</h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Import a statement to see account balances and spending summary.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AccountsTable accounts={accounts.accounts} />
      <MonthlyTable months={monthly.months} />
    </div>
  );
}
