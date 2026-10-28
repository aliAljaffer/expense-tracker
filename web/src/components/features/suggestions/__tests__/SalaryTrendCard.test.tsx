import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SalaryTrendCard } from "../SalaryTrendCard";
import type { SalaryTrendResponse } from "@/lib/api/types";

const okResponse: SalaryTrendResponse = {
  status: "ok",
  period: { from: "2026-01", to: "2026-03" },
  summary: "Salary income is rising 20% from 3,500.00 SAR to 4,200.00 SAR across 3 months.",
  evidence: {
    months: [
      { month: "2026-01", salary_total: 350000, deposit_count: 1 },
      { month: "2026-02", salary_total: 350000, deposit_count: 1 },
      { month: "2026-03", salary_total: 420000, deposit_count: 1 },
    ],
  },
  limits: "Salary detection relies on the statement row being recorded as salary.",
  next_step: "Compare the salary trend with the spending trend before changing a budget.",
  decision: "",
};

const insufficient: SalaryTrendResponse = {
  status: "insufficient_data",
  period: { from: "2026-01", to: "2026-03" },
  summary: "",
  evidence: { months: [] },
  limits: "Requires at least 3 months with salary income.",
  next_step: "Import more statements so salary months can be compared.",
};

describe("SalaryTrendCard", () => {
  it("renders the summary and month rows", () => {
    render(<SalaryTrendCard data={okResponse} />);

    expect(screen.getByText("Salary trend")).toBeInTheDocument();
    expect(screen.getByText(/Salary income is rising 20%/)).toBeInTheDocument();
    expect(screen.getAllByText("3,500.00 SAR").length).toBeGreaterThan(0);
    expect(screen.getAllByText("4,200.00 SAR").length).toBeGreaterThan(0);
  });

  it("links each month to salary transactions", () => {
    render(<SalaryTrendCard data={okResponse} />);

    expect(screen.getByRole("link", { name: "2026-01" })).toHaveAttribute(
      "href",
      "/overview/transactions?from=2026-01-01&to=2026-01-31&kind=salary"
    );
  });

  it("renders the insufficient_data state", () => {
    render(<SalaryTrendCard data={insufficient} />);

    expect(screen.getByText(/Not enough salary months yet/)).toBeInTheDocument();
    expect(screen.getByText("Import more statements so salary months can be compared.")).toBeInTheDocument();
  });

  it("hides the data behind a dismissed state with undo", () => {
    const onDecide = vi.fn(async () => {});
    render(<SalaryTrendCard data={okResponse} decision="dismissed" onDecide={onDecide} />);

    expect(screen.getByText("Dismissed. The data is still available.")).toBeInTheDocument();
    expect(screen.queryByText(/Salary income is rising/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(onDecide).toHaveBeenCalledWith("");
  });
});
