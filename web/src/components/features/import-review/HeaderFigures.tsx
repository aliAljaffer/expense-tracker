/**
 * Header figures from import preview: opening, closing, debit total, credit total, counts.
 */

import { displaySAR } from "@/lib/api/types";
import type { Header } from "@/lib/api/types";

interface HeaderFiguresProps {
  header: Header;
}

export function HeaderFigures({ header }: HeaderFiguresProps) {
  const figures = [
    {
      label: "Opening Balance",
      value: header.opening_balance ?? 0,
    },
    {
      label: "Closing Balance",
      value: header.closing_balance ?? 0,
    },
    {
      label: "Debit Total",
      value: header.stated_debit_total ?? 0,
    },
    {
      label: "Credit Total",
      value: header.stated_credit_total ?? 0,
    },
    {
      label: "Debit Count",
      value: header.stated_debit_count ?? 0,
      isCount: true,
    },
    {
      label: "Credit Count",
      value: header.stated_credit_count ?? 0,
      isCount: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
      {figures.map((figure) => (
        <div
          key={figure.label}
          className="rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-[var(--color-surface-card)] p-4"
        >
          <p className="text-[var(--text-sm)] font-[var(--weight-medium)] text-[var(--color-text-secondary)]">
            {figure.label}
          </p>
          <p className="mt-2 text-[var(--text-2xl)] font-[var(--weight-semibold)] text-[var(--color-text-primary)]">
            {figure.isCount ? figure.value : displaySAR(figure.value)}
          </p>
        </div>
      ))}
    </div>
  );
}
