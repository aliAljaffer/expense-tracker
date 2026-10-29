import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { OverviewContent } from "../OverviewContent";
import * as overviewApi from "@/lib/api/overview";

vi.mock("@/lib/api/overview");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("OverviewContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(overviewApi.getSpendingByTime).mockResolvedValue({
      from_month: "2025-11",
      to_month: "2026-10",
      hours: [],
      timed_count: 0,
      untimed_count: 0,
    });
  });

  it("renders loading state", async () => {
    vi.mocked(overviewApi.getAccounts).mockImplementation(
      () => new Promise(() => {})
    );
    vi.mocked(overviewApi.getMonthlyOverview).mockImplementation(
      () => new Promise(() => {})
    );

    render(<OverviewContent />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders error state", async () => {
    const error = new Error("Failed to fetch accounts");
    vi.mocked(overviewApi.getAccounts).mockRejectedValue(error);
    vi.mocked(overviewApi.getMonthlyOverview).mockResolvedValue({ months: [] });

    render(<OverviewContent />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load overview")).toBeInTheDocument();
    });
  });

  it("renders empty state when no accounts", async () => {
    vi.mocked(overviewApi.getAccounts).mockResolvedValue({ accounts: [] });
    vi.mocked(overviewApi.getMonthlyOverview).mockResolvedValue({ months: [] });

    render(<OverviewContent />);

    await waitFor(() => {
      expect(screen.getByText("No accounts yet")).toBeInTheDocument();
    });
  });

  it("renders populated state with accounts and months", async () => {
    vi.mocked(overviewApi.getAccounts).mockResolvedValue({
      accounts: [
        {
          id: 1,
          bank: "alinma",
          masked_number: "**********6060",
          kind: "current",
          currency: "SAR",
          balance: 118600,
          balance_date: "2026-03-31",
        },
      ],
    });

    vi.mocked(overviewApi.getMonthlyOverview).mockResolvedValue({
      months: [
        {
          month: "2026-02",
          income: { salary: 100000, transfers_in: 0, refunds: 0, other: 0, total: 100000 },
          spending: { card_purchase: 0, online_purchase: 0, intl_purchase: 0, bill_payment: 0, cash_withdrawal: 0, fee: 0, total: 0 },
          transfers: { internal: 0, external_out: 0, roundup_sweeps: 0, total: 0 },
          card_payments: 0,
          uncategorised_spending: 0,
          outflow_total: 0,
          credit_card_coverage: { card_payments: 0, purchases_recorded: 0, uncovered: 0, uncovered_share: 0 },
          transaction_count: 0,
        },
      ],
    });

    render(<OverviewContent />);

    await waitFor(() => {
      expect(screen.getByText("Accounts")).toBeInTheDocument();
      expect(screen.getByText("Monthly summary")).toBeInTheDocument();
    });
    expect(screen.getByText("Money in and out")).toBeInTheDocument();
    expect(screen.getByText("Money in")).toBeInTheDocument();
    expect(screen.getByText("Money out")).toBeInTheDocument();
    expect(screen.getByText("Spending by time")).toBeInTheDocument();
  });

  it("renders the chart empty state when there are no months", async () => {
    vi.mocked(overviewApi.getAccounts).mockResolvedValue({
      accounts: [
        {
          id: 1,
          bank: "alinma",
          masked_number: "**********6060",
          kind: "current",
          currency: "SAR",
          balance: 118600,
          balance_date: "2026-03-31",
        },
      ],
    });
    vi.mocked(overviewApi.getMonthlyOverview).mockResolvedValue({ months: [] });

    render(<OverviewContent />);

    expect(await screen.findByText("No monthly activity yet")).toBeInTheDocument();
  });

  it("renders the chart empty state when every month is zero", async () => {
    vi.mocked(overviewApi.getAccounts).mockResolvedValue({
      accounts: [
        {
          id: 1,
          bank: "alinma",
          masked_number: "**********6060",
          kind: "current",
          currency: "SAR",
          balance: 118600,
          balance_date: "2026-03-31",
        },
      ],
    });
    vi.mocked(overviewApi.getMonthlyOverview).mockResolvedValue({
      months: [
        {
          month: "2026-02",
          income: { salary: 0, transfers_in: 0, refunds: 0, other: 0, total: 0 },
          spending: { card_purchase: 0, online_purchase: 0, intl_purchase: 0, bill_payment: 0, cash_withdrawal: 0, fee: 0, total: 0 },
          transfers: { internal: 0, external_out: 0, roundup_sweeps: 0, total: 0 },
          card_payments: 0,
          uncategorised_spending: 0,
          outflow_total: 0,
          credit_card_coverage: { card_payments: 0, purchases_recorded: 0, uncovered: 0, uncovered_share: 0 },
          transaction_count: 0,
        },
      ],
    });

    render(<OverviewContent />);

    expect(await screen.findByText("No monthly activity yet")).toBeInTheDocument();
  });
});
