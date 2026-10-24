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
          <h2 className="overview-error-title">Failed to load transactions</h2>
          <p className="overview-error-text">{error}</p>
        </div>
      </div>
    );
  }

  if (!data || data.rows.length === 0) {
    return (
      <div className="overview-empty-state">
        <p className="overview-empty-state__text">No transactions found</p>
      </div>
    );
  }

  return (
    <div className="overview-sections">
      <div className="transactions-summary">
        Total: {data.total_count} transaction{data.total_count !== 1 ? "s" : ""} | Debit: {displaySAR(data.total_debit)} | Credit: {displaySAR(data.total_credit)}
      </div>

      <div className="transactions-table-wrapper">
        <table className="transactions-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th>Debit</th>
              <th>Credit</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((transaction: Transaction) => (
              <tr key={transaction.id}>
                <td>{transaction.posted_date}</td>
                <td>
                  {transaction.merchant_name || transaction.description}
                </td>
                <td>
                  {transaction.category_name || "-"}
                </td>
                <td>
                  {transaction.debit > 0 ? displaySAR(transaction.debit) : "-"}
                </td>
                <td>
                  {transaction.credit > 0 ? displaySAR(transaction.credit) : "-"}
                </td>
                <td>
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
