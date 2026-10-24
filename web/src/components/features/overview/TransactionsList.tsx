"use client";

import { useEffect, useState } from "react";
import { displaySAR } from "@/lib/api/types";
import { getTransactions } from "@/lib/api/overview";
import type { TransactionsResponse, Transaction } from "@/lib/api/types";
import type { GetTransactionsParams } from "@/lib/api/overview";

interface TransactionsListProps {
  searchParams: {
    month?: string;
    bucket?: string;
    account?: string;
    merchant?: string;
    from?: string;
    to?: string;
    limit?: string;
    offset?: string;
  };
}

export function TransactionsList({ searchParams }: TransactionsListProps) {
  const [data, setData] = useState<TransactionsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTransactions() {
      try {
        setIsLoading(true);
        setError(null);

        const params: GetTransactionsParams = {};

        if (searchParams.from) {
          params.from = searchParams.from;
        } else if (searchParams.month) {
          const [year, month] = searchParams.month.split("-");
          const fromDate = `${year}-${month}-01`;
          params.from = fromDate;
        }

        if (searchParams.to) {
          params.to = searchParams.to;
        } else if (searchParams.month) {
          const [year, month] = searchParams.month.split("-");
          const nextMonth = parseInt(month) === 12 ? "01" : (parseInt(month) + 1).toString().padStart(2, "0");
          const nextYear = parseInt(month) === 12 ? (parseInt(year) + 1).toString() : year;
          params.to = new Date(Date.parse(`${nextYear}-${nextMonth}-01`) - 86400000).toISOString().split("T")[0];
        }

        if (searchParams.bucket) {
          params.bucket = searchParams.bucket;
        }

        if (searchParams.account) {
          params.account_id = parseInt(searchParams.account, 10);
        }

        if (searchParams.merchant) {
          const merchantId = parseInt(searchParams.merchant, 10);
          if (!isNaN(merchantId) && merchantId > 0) {
            params.merchant_id = merchantId;
          }
        }

        params.limit = parseInt(searchParams.limit || "100", 10);
        params.offset = parseInt(searchParams.offset || "0", 10);

        const result = await getTransactions(params);
        setData(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load transactions";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    loadTransactions();
  }, [searchParams]);

  if (isLoading) {
    return <div>Loading...</div>;
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
            <h2 className="font-medium text-[var(--color-feedback-error-text)]">Failed to load transactions</h2>
            <p className="mt-1 text-sm text-[var(--color-feedback-error-text)]">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-8 text-center">
        <p className="text-sm text-[var(--color-text-secondary)]">No transactions found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-[var(--color-text-secondary)]">
        Total: {data.total_count} transaction{data.total_count !== 1 ? "s" : ""} | Debit: {displaySAR(data.total_debit)} | Credit: {displaySAR(data.total_credit)}
      </div>

      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-card)] overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border-default)]">
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">Date</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">Description</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">Category</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-[var(--color-text-secondary)]">Debit</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-[var(--color-text-secondary)]">Credit</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-[var(--color-text-secondary)]">Balance</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((transaction: Transaction, index: number) => (
              <tr key={transaction.id} className={index !== data.rows.length - 1 ? "border-b border-[var(--color-border-default)]" : ""}>
                <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">{transaction.posted_date}</td>
                <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">
                  {transaction.merchant_name || transaction.description}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">
                  {transaction.category_name || "-"}
                </td>
                <td className="px-4 py-3 text-sm text-right text-[var(--color-text-primary)]">
                  {transaction.debit > 0 ? displaySAR(transaction.debit) : "-"}
                </td>
                <td className="px-4 py-3 text-sm text-right text-[var(--color-text-primary)]">
                  {transaction.credit > 0 ? displaySAR(transaction.credit) : "-"}
                </td>
                <td className="px-4 py-3 text-sm text-right text-[var(--color-text-primary)]">
                  {displaySAR(transaction.balance_after)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
