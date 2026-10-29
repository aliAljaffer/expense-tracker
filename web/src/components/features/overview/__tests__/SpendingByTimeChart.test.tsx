import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SpendingByTimeChart } from "../SpendingByTimeChart";
import type { TimeBucket } from "@/lib/api/types";

function hours(overrides: Partial<TimeBucket>[] = []): TimeBucket[] {
  return Array.from({ length: 24 }, (_, hour) => {
    const override = overrides.find((entry) => entry.hour === hour);
    return { hour, debit: 0, count: 0, ...override };
  });
}

describe("SpendingByTimeChart", () => {
  it("reports the range and how many spending rows carry a time", () => {
    render(
      <SpendingByTimeChart
        data={{
          from_month: "2025-11",
          to_month: "2026-10",
          hours: hours([{ hour: 9, debit: 1500, count: 2 }]),
          timed_count: 2,
          untimed_count: 3,
        }}
      />,
    );

    expect(screen.getByText("Spending by time")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Debit in SAR by hour of day, Nov 2025 to Oct 2026. Each bar sums the spending in that hour over the range. 2 of 5 spending rows carry a time.",
      ),
    ).toBeInTheDocument();
  });

  it("shows the empty state when no row carries a time", () => {
    render(
      <SpendingByTimeChart
        data={{
          from_month: "2025-11",
          to_month: "2026-10",
          hours: hours(),
          timed_count: 0,
          untimed_count: 4,
        }}
      />,
    );

    expect(screen.getByText("No transaction times yet")).toBeInTheDocument();
  });

  it("shows the unavailable state when the fetch failed", () => {
    render(<SpendingByTimeChart data={null} unavailable />);

    expect(screen.getByText("Spending by time unavailable")).toBeInTheDocument();
  });
});
