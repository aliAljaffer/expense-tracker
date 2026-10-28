"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getAccounts, getMonthlyOverview } from "@/lib/api/overview";
import { type AccountsResponse, type MonthlyResponse } from "@/lib/api/types";
import { AccountsTable } from "./AccountsTable";
import { MonthlyMoneyChart } from "./MonthlyMoneyChart";
import { MonthlyTable } from "./MonthlyTable";
import { OverviewSummary } from "./OverviewSummary";

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
    return <div className="stack--normal">Loading...</div>;
  }

  if (error) {
    return (
      <div className="overview-error-box">
        <div className="overview-error-icon">
          <svg viewBox="0 0 20 20" fill="currentColor" width="24" height="24">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="overview-error-content">
          <h2 className="overview-error-title">Failed to load overview</h2>
          <p className="overview-error-text">{error}</p>
        </div>
      </div>
    );
  }

  if (!accounts || !monthly) {
    return null;
  }

  if (accounts.accounts.length === 0) {
    return (
      <div className="overview-empty-state">
        <h2 className="overview-empty-state__title">No accounts yet</h2>
        <p className="overview-empty-state__text">
          Import a statement to see balances, monthly flow, and spending.
        </p>
        <Link href="/imports" className="btn btn--primary overview-empty-state__action">
          Import a statement
        </Link>
      </div>
    );
  }

  return (
    <div className="overview-sections">
      <OverviewSummary months={monthly.months} />
      <MonthlyMoneyChart months={monthly.months} />
      <AccountsTable accounts={accounts.accounts} />
      <MonthlyTable months={monthly.months} />
    </div>
  );
}
