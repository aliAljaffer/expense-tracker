"use client";

import { displaySAR } from "@/lib/api/types";
import type { Account } from "@/lib/api/types";

interface AccountsTableProps {
  accounts: Account[];
}

export function AccountsTable({ accounts }: AccountsTableProps) {
  return (
    <div className="space-y-2">
      <h2 className="text-lg font-medium">Accounts</h2>
      <div className="rounded-lg border border-[var(--color-border-default)] bg-[var(--color-surface-card)] overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--color-border-default)]">
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">Bank</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">Number</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">Type</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-[var(--color-text-secondary)]">Balance</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-[var(--color-text-secondary)]">As of</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((account, index) => (
              <tr key={account.id} className={index !== accounts.length - 1 ? "border-b border-[var(--color-border-default)]" : ""}>
                <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">{account.bank}</td>
                <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">{account.masked_number}</td>
                <td className="px-4 py-3 text-sm text-[var(--color-text-primary)]">{account.kind}</td>
                <td className="px-4 py-3 text-sm text-right text-[var(--color-text-primary)]">
                  {account.balance !== null ? displaySAR(account.balance) : "-"}
                </td>
                <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                  {account.balance_date || "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
