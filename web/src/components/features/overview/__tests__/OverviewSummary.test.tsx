import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  OverviewSummary,
  formatSignedSAR,
  latestMonth,
} from "../OverviewSummary";
import type { MonthlyOverview } from "@/lib/api/types";

function month(overrides: Partial<MonthlyOverview>): MonthlyOverview {
  return {
    month: "2026-02",
    income: { salary: 100000, transfers_in: 0, refunds: 0, other: 0, total: 100000 },
    spending: {
      card_purchase: 0,
      online_purchase: 0,
      intl_purchase: 0,
      bill_payment: 0,
      cash_withdrawal: 0,
      fee: 0,
      total: 0,
    },
    transfers: { internal: 0, external_out: 0, roundup_sweeps: 0, total: 0 },
    card_payments: 0,
    uncategorised_spending: 0,
    outflow_total: 0,
    credit_card_coverage: {
      card_payments: 0,
      purchases_recorded: 0,
      uncovered: 0,
      uncovered_share: 0,
    },
    transaction_count: 0,
    ...overrides,
  };
}

describe("latestMonth", () => {
  it("returns the newest month regardless of input order", () => {
    const months = [
      month({ month: "2026-01" }),
      month({ month: "2026-03" }),
      month({ month: "2026-02" }),
    ];

    expect(latestMonth(months)?.month).toBe("2026-03");
  });

  it("returns null with no months", () => {
    expect(latestMonth([])).toBeNull();
  });
});

describe("formatSignedSAR", () => {
  it("keeps the minus sign outside the currency amount", () => {
    expect(formatSignedSAR(-130575)).toBe("-1,305.75 SAR");
  });
});

describe("OverviewSummary", () => {
  it("renders the latest month outflow, income, and net", () => {
    render(
      <OverviewSummary
        months={[
          month({
            month: "2026-03",
            income: { salary: 500000, transfers_in: 0, refunds: 0, other: 0, total: 500000 },
            outflow_total: 630575,
          }),
          month({ month: "2026-02", outflow_total: 999999 }),
        ]}
      />,
    );

    expect(screen.getByText("Money out in March 2026")).toBeInTheDocument();
    expect(screen.getByText("6,305.75 SAR")).toBeInTheDocument();
    expect(screen.getByText("5,000.00 SAR")).toBeInTheDocument();
    expect(screen.getByText("-1,305.75 SAR")).toBeInTheDocument();
  });

  it("renders nothing without months", () => {
    const { container } = render(<OverviewSummary months={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
