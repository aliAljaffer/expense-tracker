import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccountsTable } from "../AccountsTable";
import type { Account } from "@/lib/api/types";

describe("AccountsTable", () => {
  const mockAccounts: Account[] = [
    {
      id: 1,
      bank: "alinma",
      masked_number: "**********6060",
      kind: "current",
      currency: "SAR",
      balance: 118600,
      balance_date: "2026-03-31",
    },
    {
      id: 2,
      bank: "alrajhi",
      masked_number: "**********1234",
      kind: "savings",
      currency: "SAR",
      balance: null,
      balance_date: null,
    },
  ];

  it("renders accounts table with data", () => {
    render(<AccountsTable accounts={mockAccounts} />);

    expect(screen.getByText("Accounts")).toBeInTheDocument();
    expect(screen.getByText("alinma")).toBeInTheDocument();
    expect(screen.getByText("**********6060")).toBeInTheDocument();
    expect(screen.getByText("1,186.00 SAR")).toBeInTheDocument();
  });

  it("displays null balance as dash", () => {
    render(<AccountsTable accounts={mockAccounts} />);

    const rows = screen.getAllByRole("row");
    const savingsRow = rows[2];
    expect(savingsRow.textContent).toContain("-");
  });

  it("formats balances correctly", () => {
    const accounts: Account[] = [
      {
        id: 1,
        bank: "test",
        masked_number: "****0001",
        kind: "current",
        currency: "SAR",
        balance: 2575,
        balance_date: "2026-01-01",
      },
    ];

    render(<AccountsTable accounts={accounts} />);
    expect(screen.getByText("25.75 SAR")).toBeInTheDocument();
  });
});
