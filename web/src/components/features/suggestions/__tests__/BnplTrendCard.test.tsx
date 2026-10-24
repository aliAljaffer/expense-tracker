import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BnplTrendCard } from "../BnplTrendCard";
import type { BnplResponse } from "@/lib/api/types";

describe("BnplTrendCard", () => {
  const mockOkResponse: BnplResponse = {
    status: "ok",
    period: { from: "2026-01", to: "2026-12" },
    summary: "BNPL commitments are rising: SAR 4500.00 this month vs SAR 3500.00 average.",
    evidence: {
      months: [
        {
          month: "2026-04",
          bnpl_outflow: 450000,
          payment_count: 3,
          previous_month: 400000,
          three_month_average: 350000,
          is_rising: true,
          transaction_ids: [200, 201, 202],
        },
      ],
    },
    limits: "BNPL identification requires merchants to be manually marked.",
    next_step: "Review upcoming BNPL payment dates and plan repayment.",
  };

  const mockInsufficientDataResponse: BnplResponse = {
    status: "insufficient_data",
    period: { from: "2026-01", to: "2026-01" },
    summary: "Not enough data",
    evidence: { months: [] },
    limits: "Requires BNPL merchants",
    next_step: "Mark merchants as BNPL",
  };

  it("renders ok status with months table", () => {
    render(<BnplTrendCard data={mockOkResponse} />);

    expect(screen.getByText("BNPL trend")).toBeInTheDocument();
    expect(screen.getByText(/BNPL commitments are rising/)).toBeInTheDocument();
    expect(screen.getByText("2026-04")).toBeInTheDocument();
    expect(screen.getByText("Rising")).toBeInTheDocument();
  });

  it("renders insufficient_data state", () => {
    render(<BnplTrendCard data={mockInsufficientDataResponse} />);

    expect(screen.getByText("BNPL trend")).toBeInTheDocument();
    expect(screen.getByText(/No BNPL commitments yet/)).toBeInTheDocument();
    expect(screen.getByText("Mark merchants as BNPL")).toBeInTheDocument();
  });

  it("displays limits and next step", () => {
    render(<BnplTrendCard data={mockOkResponse} />);

    expect(screen.getByText(/BNPL identification requires/)).toBeInTheDocument();
    expect(screen.getByText(/Review upcoming BNPL/)).toBeInTheDocument();
  });

  it("formats money correctly", () => {
    render(<BnplTrendCard data={mockOkResponse} />);

    expect(screen.getByText("4,500.00 SAR")).toBeInTheDocument();
    expect(screen.getByText("4,000.00 SAR")).toBeInTheDocument();
    expect(screen.getByText("3,500.00 SAR")).toBeInTheDocument();
  });
});
