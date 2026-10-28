import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryCell } from "../CategoryCell";
import { updateTransactionCategory } from "@/lib/api/categories";
import type { Category, Transaction } from "@/lib/api/types";

vi.mock("@/lib/api/categories", () => ({
  updateTransactionCategory: vi.fn(),
}));

const update = vi.mocked(updateTransactionCategory);

const categories: Category[] = [
  { id: 1, name: "Housing" },
  { id: 3, name: "Groceries" },
  { id: 4, name: "Dining" },
];

function row(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 34,
    account_id: 1,
    posted_date: "2026-03-05",
    posted_time: "10:15:00",
    description: "card purchase sample market",
    debit: 2575,
    credit: 0,
    balance_after: 118600,
    kind: "card_purchase",
    counts_as_spending: true,
    merchant_id: 9,
    merchant_name: "Sample Market",
    category_id: 3,
    category_name: "Groceries",
    fx_currency: null,
    fx_amount: null,
    ...overrides,
  };
}

function trigger() {
  return screen.getByRole("button", { name: /^Category: / });
}

describe("CategoryCell", () => {
  beforeEach(() => {
    update.mockReset();
    update.mockResolvedValue(undefined);
  });

  it("lists every category and the uncategorised option", async () => {
    const user = userEvent.setup();
    render(<CategoryCell transaction={row()} categories={categories} />);

    expect(trigger()).toHaveAccessibleName("Category: Groceries");
    await user.click(trigger());

    expect(screen.getByRole("option", { name: "Uncategorised" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Housing" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Dining" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(4);
    expect(
      screen.getByRole("checkbox", { name: "Apply to every row from this merchant" })
    ).toBeInTheDocument();
  });

  it("saves the chosen category and shows the saved state", async () => {
    const user = userEvent.setup();
    render(<CategoryCell transaction={row()} categories={categories} />);

    await user.click(trigger());
    await user.click(screen.getByRole("option", { name: "Dining" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith(34, 4, false));
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
    expect(trigger()).toHaveAccessibleName("Category: Dining");
  });

  it("sends apply_to_merchant when the checkbox is ticked", async () => {
    const user = userEvent.setup();
    render(<CategoryCell transaction={row()} categories={categories} />);

    await user.click(trigger());
    await user.click(screen.getByRole("checkbox", { name: "Apply to every row from this merchant" }));
    await user.click(screen.getByRole("option", { name: "Housing" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith(34, 1, true));
  });

  it("clears the category through the uncategorised option", async () => {
    const user = userEvent.setup();
    render(<CategoryCell transaction={row()} categories={categories} />);

    await user.click(trigger());
    await user.click(screen.getByRole("option", { name: "Uncategorised" }));

    await waitFor(() => expect(update).toHaveBeenCalledWith(34, null, false));
    expect(trigger()).toHaveAccessibleName("Category: Uncategorised");
  });

  it("shows an error and restores the old category when the save fails", async () => {
    update.mockRejectedValue(new Error("nope"));
    const user = userEvent.setup();
    render(<CategoryCell transaction={row()} categories={categories} />);

    await user.click(trigger());
    await user.click(screen.getByRole("option", { name: "Dining" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save");
    expect(trigger()).toHaveAccessibleName("Category: Groceries");
  });

  it("opens with Enter and closes with Escape", async () => {
    const user = userEvent.setup();
    render(<CategoryCell transaction={row()} categories={categories} />);

    trigger().focus();
    await user.keyboard("{Enter}");
    expect(trigger()).toHaveAttribute("aria-expanded", "true");

    await user.keyboard("{Escape}");
    expect(trigger()).toHaveAttribute("aria-expanded", "false");
  });
});
