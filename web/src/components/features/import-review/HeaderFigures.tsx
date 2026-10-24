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
    <div className="import-grid">
      {figures.map((figure) => (
        <div
          key={figure.label}
          className="import-figure"
        >
          <p className="import-figure__label">
            {figure.label}
          </p>
          <p className="import-figure__value">
            {figure.isCount ? figure.value : displaySAR(figure.value)}
          </p>
        </div>
      ))}
    </div>
  );
}
