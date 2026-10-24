import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MonthlyTable } from "../MonthlyTable";
import type { MonthlyOverview } from "@/lib/api/types";

describe("MonthlyTable", () => {
  const mockMonth: MonthlyOverview = {
    month: "2026-02",
    income: {
      salary: 100000,
      transfers_in: 5000,
      refunds: 2500,
      other: 1200,
      total: 108700,
    },
    spending: {
      card_purchase: 2575,
      online_purchase: 990,
      intl_purchase: 2667,
      bill_payment: 15000,
      cash_withdrawal: 50000,
      fee: 1250,
      total: 72482,
    },
    transfers: {
      internal: 20000,
      external_out: 3000,
      roundup_sweeps: 250,
      total: 23250,
    },
    card_payments: 58000,
    uncategorised_spending: 1250,
    outflow_total: 143732,
    credit_card_coverage: {
      card_payments: 58000,
      purchases_recorded: 6232,
      uncovered: 51768,
      uncovered_share: 0.892552,
    },
    transaction_count: 14,
  };

  it("renders monthly summary table", () => {
    render(<MonthlyTable months={[mockMonth]} />);

    expect(screen.getByText("Monthly summary")).toBeInTheDocument();
    expect(screen.getByText("2026-02")).toBeInTheDocument();
  });

  it("formats amounts correctly", () => {
    render(<MonthlyTable months={[mockMonth]} />);

    expect(screen.getByText("1,087.00 SAR")).toBeInTheDocument();
    expect(screen.getByText("724.82 SAR")).toBeInTheDocument();
    expect(screen.getByText("232.50 SAR")).toBeInTheDocument();
  });

  it("creates correct links with search params", () => {
    render(<MonthlyTable months={[mockMonth]} />);

    const incomeLink = screen.getByRole("link", { name: /1,087.00 SAR/ });
    expect(incomeLink).toHaveAttribute("href", "/overview/transactions?month=2026-02&bucket=income");

    const spendingLink = screen.getByRole("link", { name: /724.82 SAR/ });
    expect(spendingLink).toHaveAttribute("href", "/overview/transactions?month=2026-02&bucket=spending");

    const transfersLink = screen.getByRole("link", { name: /232.50 SAR/ });
    expect(transfersLink).toHaveAttribute("href", "/overview/transactions?month=2026-02&bucket=transfers");
  });

  it("shows card coverage percentage", () => {
    render(<MonthlyTable months={[mockMonth]} />);

    expect(screen.getByText("89%")).toBeInTheDocument();
  });

  it("renders empty state when no months", () => {
    render(<MonthlyTable months={[]} />);

    expect(screen.getByText("No transactions yet")).toBeInTheDocument();
  });

  it("separates transfers from spending totals", () => {
    const monthWithTransfer: MonthlyOverview = {
      ...mockMonth,
      spending: { ...mockMonth.spending, total: 72482 },
      transfers: { ...mockMonth.transfers, total: 23250 },
    };

    render(<MonthlyTable months={[monthWithTransfer]} />);

    const spendingLink = screen.getByRole("link", { name: /724.82 SAR/ });
    const transfersLink = screen.getByRole("link", { name: /232.50 SAR/ });

    expect(spendingLink).toHaveAttribute("href", expect.stringContaining("bucket=spending"));
    expect(transfersLink).toHaveAttribute("href", expect.stringContaining("bucket=transfers"));
  });

  it("handles roundup sweeps separately from transfers", () => {
    const monthWithSweep: MonthlyOverview = {
      ...mockMonth,
      transfers: {
        internal: 20000,
        external_out: 3000,
        roundup_sweeps: 250,
        total: 23250,
      },
    };

    render(<MonthlyTable months={[monthWithSweep]} />);

    const transfersLink = screen.getByRole("link", { name: /232.50 SAR/ });
    expect(transfersLink).toHaveAttribute("href", expect.stringContaining("bucket=transfers"));
  });

  it("displays uncategorised spending separately", () => {
    render(<MonthlyTable months={[mockMonth]} />);

    const uncategorisedLink = screen.getByRole("link", { name: /12.50 SAR/ });
    expect(uncategorisedLink).toHaveAttribute("href", "/overview/transactions?month=2026-02&bucket=uncategorised");
  });
});
