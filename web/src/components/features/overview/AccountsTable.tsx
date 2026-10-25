"use client";

import { displaySAR } from "@/lib/api/types";
import type { Account } from "@/lib/api/types";

interface AccountsTableProps {
  accounts: Account[];
}

export function AccountsTable({ accounts }: AccountsTableProps) {
  return (
    <div className="overview-section">
      <h2 className="overview-section__title">Accounts</h2>
      <p className="overview-table-hint">Scroll to see all columns</p>
      <div
        className="overview-table-wrapper"
        role="region"
        aria-label="Accounts table"
        tabIndex={0}
      >
        <table className="overview-table">
          <thead>
            <tr>
              <th>Bank</th>
              <th>Number</th>
              <th>Type</th>
              <th>Balance</th>
              <th>As of</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account) => (
              <tr key={account.id}>
                <td>{account.bank}</td>
                <td>{account.masked_number}</td>
                <td>{account.kind}</td>
                <td>
                  {account.balance !== null ? displaySAR(account.balance) : "-"}
                </td>
                <td>{account.balance_date || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
