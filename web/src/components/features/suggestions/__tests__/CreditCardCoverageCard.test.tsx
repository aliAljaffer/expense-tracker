import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreditCardCoverageCard } from "../CreditCardCoverageCard";
import type { CardCoverageResponse } from "@/lib/api/types";

describe("CreditCardCoverageCard", () => {
  const mockOkResponse: CardCoverageResponse = {
    status: "ok",
    period: { from: "2026-02", to: "2026-12" },
    summary: "Seven of twelve months had card payments without matching purchase statements.",
    evidence: {
      months: [
        {
          month: "2026-02",
          card_payments: 58000,
          purchases_recorded: 6232,
          uncovered: 51768,
          uncovered_share: 0.892552,
          transaction_ids: [123, 456],
        },
      ],
    },
    limits: "Does not account for manually entered card statements or categories.",
    next_step: "Import the card statement for Feb 2026.",
  };

  const mockInsufficientDataResponse: CardCoverageResponse = {
    status: "insufficient_data",
    period: { from: "2026-01", to: "2026-01" },
    summary: "Not enough data",
    evidence: { months: [] },
    limits: "Requires card payments",
    next_step: "Import card statements",
  };

  it("renders the summary and the evidence rows for ok data", () => {
    render(<CreditCardCoverageCard data={mockOkResponse} />);

    expect(screen.getByText("Credit card coverage")).toBeInTheDocument();
    expect(screen.getByText(/Seven of twelve months/)).toBeInTheDocument();
    expect(screen.getByText("580.00 SAR")).toBeInTheDocument();
  });

  it("renders insufficient_data state", () => {
    render(<CreditCardCoverageCard data={mockInsufficientDataResponse} />);

    expect(screen.getByText(/Not enough data yet/)).toBeInTheDocument();
    expect(screen.getByText("Import card statements")).toBeInTheDocument();
  });

  it("links each uncovered month to the filtered transactions", () => {
    render(<CreditCardCoverageCard data={mockOkResponse} />);

    expect(screen.getByRole("link", { name: "2026-02" })).toHaveAttribute(
      "href",
      "/overview/transactions?from=2026-02-01&to=2026-02-31&bucket=card_payments"
    );
  });
});
