import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { ChartCard, ChartEmpty, ChartTooltip } from "./chart";

describe("ChartCard", () => {
  it("renders the title and an empty state next to a line chart", async () => {
    render(
      <ChartCard title="Spending trend" lede="Last 30 days">
        <ChartEmpty message="No data for this period" hint="Import a statement to see it." />
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={[{ month: "Jan", amount: 1200 }]}>
            <Line dataKey="amount" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>,
    );

    expect(screen.getByText("Spending trend")).toBeInTheDocument();
    expect(screen.getByText("Last 30 days")).toBeInTheDocument();
    expect(await screen.findByText("No data for this period")).toBeInTheDocument();
  });
});

describe("ChartTooltip", () => {
  it("formats money values through displaySAR", () => {
    render(
      <ChartTooltip
        active
        money
        label="Jan"
        payload={[
          { dataKey: "amount", name: "Amount", value: 123456, color: "var(--color-data-viz-categorical-1)" },
        ]}
      />,
    );

    expect(screen.getByText("1,234.56 SAR")).toBeInTheDocument();
  });
});
