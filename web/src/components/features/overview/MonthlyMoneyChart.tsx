"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthlyOverview } from "@/lib/api/types";
import {
  ChartCard,
  ChartEmpty,
  ChartTooltip,
  chartAxisProps,
  chartGridProps,
} from "@/components/ui/chart";

const shortMonthFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

const fullMonthFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function monthDate(month: string): Date {
  return new Date(`${month}-01T00:00:00Z`);
}

function shortMonth(month: string): string {
  return shortMonthFormat.format(monthDate(month));
}

function fullMonth(month: string | number): string {
  return fullMonthFormat.format(monthDate(String(month)));
}

function axisMoney(halalas: number): string {
  const riyals = halalas / 100;
  if (riyals >= 1000) return `${Math.round(riyals / 1000)}k`;
  return String(Math.round(riyals));
}

export function MonthlyMoneyChart({ months }: { months: MonthlyOverview[] }) {
  const hasActivity = months.some(
    (month) => month.income.total !== 0 || month.outflow_total !== 0,
  );

  const data = [...months]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((month) => ({
      month: month.month,
      income: month.income.total,
      outflow: month.outflow_total,
    }));

  return (
    <ChartCard
      className="overview-chart"
      title="Money in and out"
      lede="Income against everything that left your accounts, month by month. Amounts in SAR."
    >
      {!hasActivity ? (
        <ChartEmpty
          message="No monthly activity yet"
          hint="Import a statement to see money in and out."
        />
      ) : (
        <div className="monthly-chart">
          <ul className="monthly-chart__legend" aria-label="Series">
            <li className="monthly-chart__legend-item">
              <span
                aria-hidden="true"
                className="monthly-chart__swatch monthly-chart__swatch--in"
              />
              Money in
            </li>
            <li className="monthly-chart__legend-item">
              <span
                aria-hidden="true"
                className="monthly-chart__swatch monthly-chart__swatch--out"
              />
              Money out
            </li>
          </ul>
          <div
            className="monthly-chart__plot"
            role="img"
            aria-label="Money in and money out by month"
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
                barGap={2}
              >
                <CartesianGrid {...chartGridProps} />
                <XAxis
                  dataKey="month"
                  tickFormatter={shortMonth}
                  {...chartAxisProps}
                />
                <YAxis width={44} tickFormatter={axisMoney} {...chartAxisProps} />
                <Tooltip
                  cursor={{ fill: "var(--color-surface-sunken)" }}
                  content={<ChartTooltip money labelFormatter={fullMonth} />}
                />
                <Bar
                  dataKey="income"
                  name="Money in"
                  fill="var(--color-chart-1)"
                  maxBarSize={32}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="outflow"
                  name="Money out"
                  fill="var(--color-chart-2)"
                  maxBarSize={32}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </ChartCard>
  );
}
