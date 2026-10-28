import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TransferMatchesCard } from "../TransferMatchesCard";
import type { TransferMatchesResponse } from "@/lib/api/types";

const okResponse: TransferMatchesResponse = {
  status: "ok",
  period: { from: "2026-02", to: "2026-03" },
  summary: "2 likely internal transfers found. They are not counted as spending, so the spending figure is not inflated.",
  evidence: {
    matches: [
      {
        amount: 50000,
        debit_date: "2026-02-10",
        debit_account: "Alinma **********0040",
        debit_transaction_id: 10,
        credit_date: "2026-02-11",
        credit_account: "Al Rajhi **********0041",
        credit_transaction_id: 11,
        counts_as_spending: false,
      },
      {
        amount: 120000,
        debit_date: "2026-03-02",
        debit_account: "Alinma **********0040",
        debit_transaction_id: 12,
        credit_date: "2026-03-02",
        credit_account: "Al Rajhi **********0041",
        credit_transaction_id: 13,
        counts_as_spending: false,
      },
    ],
  },
  limits: "Matching uses amount, account and a 3 day window.",
  next_step: "Review each pair and mark it as an internal transfer.",
  decision: "",
};

const insufficient: TransferMatchesResponse = {
  status: "insufficient_data",
  period: { from: "2026-02", to: "2026-03" },
  summary: "",
  evidence: { matches: [] },
  limits: "Pairs need one debit and one credit.",
  next_step: "Import statements for the other accounts.",
};

describe("TransferMatchesCard", () => {
  it("renders each pair with masked accounts", () => {
    render(<TransferMatchesCard data={okResponse} />);

    expect(screen.getByText("Transfer matches")).toBeInTheDocument();
    expect(screen.getByText(/2 likely internal transfers/)).toBeInTheDocument();
    expect(screen.getAllByText("Alinma **********0040")).toHaveLength(2);
    expect(screen.getByText("500.00 SAR")).toBeInTheDocument();
  });

  it("links a pair to the transfers bucket", () => {
    render(<TransferMatchesCard data={okResponse} />);

    expect(screen.getByRole("link", { name: "2026-02-10" })).toHaveAttribute(
      "href",
      "/overview/transactions?from=2026-02-10&to=2026-02-11&bucket=transfers"
    );
  });

  it("renders the insufficient_data state", () => {
    render(<TransferMatchesCard data={insufficient} />);

    expect(screen.getByText(/No likely internal transfers yet/)).toBeInTheDocument();
    expect(screen.getByText("Import statements for the other accounts.")).toBeInTheDocument();
  });

  it("hides the data behind a dismissed state with undo", () => {
    const onDecide = vi.fn(async () => {});
    render(<TransferMatchesCard data={okResponse} decision="dismissed" onDecide={onDecide} />);

    expect(screen.getByText("Dismissed. The data is still available.")).toBeInTheDocument();
    expect(screen.queryByText(/2 likely internal transfers/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onDecide).toHaveBeenCalledWith("");
  });
});
