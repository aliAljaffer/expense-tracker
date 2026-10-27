import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RecurringPaymentsCard } from "../RecurringPaymentsCard";
import type { RecurringResponse } from "@/lib/api/types";

describe("RecurringPaymentsCard", () => {
  const mockOkResponse: RecurringResponse = {
    status: "ok",
    period: { from: "2026-02", to: "2026-12" },
    summary: "Nine recurring payments found. The largest is rent (SAR 3500.00/month).",
    evidence: {
      recurring_series: [
        {
          merchant: "Rent Agency",
          merchant_id: 1,
          occurrence_count: 12,
          distinct_months: 12,
          median_amount: 350000,
          total_amount: 4200000,
          first_date: "2026-02-01",
          last_date: "2026-12-01",
          cadence_days: null,
          transaction_ids: [100, 101],
        },
      ],
    },
    limits: "Recurring series must appear in at least 3 distinct months.",
    next_step: "Review and categorize the recurring payments.",
  };

  const mockInsufficientDataResponse: RecurringResponse = {
    status: "insufficient_data",
    period: { from: "2026-01", to: "2026-01" },
    summary: "Not enough data",
    evidence: { recurring_series: [] },
    limits: "Requires 3 months of data",
    next_step: "Continue importing statements",
  };

  it("renders the summary and the series rows for ok data", () => {
    render(<RecurringPaymentsCard data={mockOkResponse} />);

    expect(screen.getByText("Recurring payments")).toBeInTheDocument();
    expect(screen.getByText(/Nine recurring payments found/)).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });

  it("renders insufficient_data state", () => {
    render(<RecurringPaymentsCard data={mockInsufficientDataResponse} />);

    expect(screen.getByText(/Not enough data yet/)).toBeInTheDocument();
    expect(screen.getByText("Continue importing statements")).toBeInTheDocument();
  });

  it("links to filtered transactions with merchant and date range", () => {
    render(<RecurringPaymentsCard data={mockOkResponse} />);

    expect(screen.getByRole("link", { name: "Rent Agency" })).toHaveAttribute(
      "href",
      "/overview/transactions?merchant=1&from=2026-02-01&to=2026-12-01"
    );
  });

  it("renders ChartEmpty when the period has no series", () => {
    render(
      <RecurringPaymentsCard
        data={{ ...mockOkResponse, evidence: { recurring_series: [] } }}
      />
    );

    expect(screen.getByText("No recurring series in this period")).toBeInTheDocument();
    expect(screen.getByText(/Nine recurring payments found/)).toBeInTheDocument();
  });
});
