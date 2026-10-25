import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpendingChart, debitByDay } from "../SpendingChart";
import type { Transaction } from "@/lib/api/types";

function row(overrides: Partial<Transaction>): Transaction {
  return {
    id: 1,
    account_id: 1,
    posted_date: "2026-03-01",
    posted_time: "10:00:00",
    description: "synthetic row",
    debit: 0,
    credit: 0,
    balance_after: 100000,
    kind: "card_purchase",
    counts_as_spending: true,
    merchant_id: null,
    merchant_name: null,
    category_id: null,
    category_name: null,
    fx_currency: null,
    fx_amount: null,
    ...overrides,
  };
}

const rows: Transaction[] = [
  row({ id: 1, posted_date: "2026-03-02", debit: 1000 }),
  row({ id: 2, posted_date: "2026-03-01", debit: 2500 }),
  row({ id: 3, posted_date: "2026-03-02", debit: 500 }),
  row({ id: 4, posted_date: "2026-03-03", credit: 90000 }),
];

describe("debitByDay", () => {
  it("sums debit per day in date order and ignores credit-only days", () => {
    expect(debitByDay(rows)).toEqual([
      { day: "2026-03-01", debit: 2500 },
      { day: "2026-03-02", debit: 1500 },
    ]);
  });
});

describe("SpendingChart", () => {
  it("renders the title and the filter range", () => {
    render(
      <SpendingChart rows={rows} totalCount={rows.length} from="2026-03-01" to="2026-03-31" />,
    );

    expect(screen.getByText("Spending over time")).toBeInTheDocument();
    expect(screen.getByText("Debit per day in SAR, 2026-03-01 to 2026-03-31.")).toBeInTheDocument();
  });

  it("says when the chart only sees the newest rows", () => {
    render(<SpendingChart rows={rows} totalCount={620} from="2026-03-01" to="2026-03-31" />);

    expect(
      screen.getByText(/The newest 4 of 620 rows in this range; earlier days are not plotted\./),
    ).toBeInTheDocument();
  });

  it("shows the empty state when the range has no debit", () => {
    render(<SpendingChart rows={[row({ credit: 90000 })]} totalCount={1} />);

    expect(screen.getByText("No spending in this range")).toBeInTheDocument();
  });

  it("shows the unavailable state when the chart fetch failed", () => {
    render(<SpendingChart rows={[]} totalCount={0} unavailable />);

    expect(screen.getByText("Spending chart unavailable")).toBeInTheDocument();
  });
});
