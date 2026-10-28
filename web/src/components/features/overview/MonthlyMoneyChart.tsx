"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { displaySAR } from "@/lib/api/types";
import type { MonthlyOverview } from "@/lib/api/types";
import {
  ChartCard,
  ChartEmpty,
  chartAxisProps,
  chartGridProps,
} from "@/components/ui/chart";
import { formatSignedSAR } from "./OverviewSummary";

const shortMonthFormat = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
});

const fullMonthFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

interface MonthlyDatum {
  month: string;
  income: number;
  outflow: number;
  transactions: number;
}

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

function monthHref(month: string): string {
  return `/overview/transactions?month=${month}&bucket=all`;
}

interface MonthlyTooltipProps {
  active?: boolean;
  label?: string | number;
  data: MonthlyDatum[];
}

function MonthlyTooltip({ active, label, data }: MonthlyTooltipProps) {
  if (!active) return null;

  const point = data.find((entry) => entry.month === String(label));
  if (!point) return null;

  const net = point.income - point.outflow;

  return (
    <div className="chart-tooltip" role="tooltip">
      <p className="chart-tooltip__label">{fullMonth(point.month)}</p>
      <ul className="chart-tooltip__list">
        <li className="chart-tooltip__row">
          <span
            aria-hidden="true"
            className="chart-tooltip__swatch"
            style={{ backgroundColor: "var(--color-chart-1)" }}
          />
          <span className="chart-tooltip__name">Money in</span>
          <span className="chart-tooltip__value">{displaySAR(point.income)}</span>
        </li>
        <li className="chart-tooltip__row">
          <span
            aria-hidden="true"
            className="chart-tooltip__swatch"
            style={{ backgroundColor: "var(--color-chart-2)" }}
          />
          <span className="chart-tooltip__name">Money out</span>
          <span className="chart-tooltip__value">{displaySAR(point.outflow)}</span>
        </li>
        <li className="chart-tooltip__row chart-tooltip__row--total">
          <span className="chart-tooltip__name">Net</span>
          <span className="chart-tooltip__value">{formatSignedSAR(net)}</span>
        </li>
        <li className="chart-tooltip__row">
          <span className="chart-tooltip__name">Transactions</span>
          <span className="chart-tooltip__value">{point.transactions}</span>
        </li>
      </ul>
      <p className="chart-tooltip__hint">Select to open this month.</p>
    </div>
  );
}

export function MonthlyMoneyChart({ months }: { months: MonthlyOverview[] }) {
  const router = useRouter();

  const hasActivity = months.some(
    (month) => month.income.total !== 0 || month.outflow_total !== 0,
  );

  const data: MonthlyDatum[] = [...months]
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((month) => ({
      month: month.month,
      income: month.income.total,
      outflow: month.outflow_total,
      transactions: month.transaction_count,
    }));

  const openMonth = (month: string) => router.push(monthHref(month));

  return (
    <div className="chart-block">
      <ChartCard
        className="overview-chart"
        title="Money in and out"
        lede="Income against everything that left your accounts, month by month. Select a month to open its transactions."
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
              role="group"
              aria-label="Money in and money out by month. Select a month to open its transactions."
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={data}
                  margin={{ top: 8, right: 4, bottom: 0, left: 0 }}
                  accessibilityLayer
                  onClick={(state) => {
                    if (typeof state.activeLabel !== "string") return;
                    openMonth(state.activeLabel);
                  }}
                >
                  <CartesianGrid {...chartGridProps} />
                  <XAxis
                    dataKey="month"
                    tickFormatter={shortMonth}
                    minTickGap={16}
                    {...chartAxisProps}
                  />
                  <YAxis width={44} tickFormatter={axisMoney} {...chartAxisProps} />
                  <Tooltip
                    cursor={{ stroke: "var(--color-border-strong)", strokeWidth: 1 }}
                    content={<MonthlyTooltip data={data} />}
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    name="Money in"
                    stroke="var(--color-chart-1)"
                    fill="var(--color-chart-1)"
                    fillOpacity={0.18}
                    strokeWidth={2}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="outflow"
                    name="Money out"
                    stroke="var(--color-chart-2)"
                    fill="var(--color-chart-2)"
                    fillOpacity={0.18}
                    strokeWidth={2}
                    activeDot={{ r: 4, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </ChartCard>

      {hasActivity ? (
        <nav className="chart-months" aria-label="Open a month">
          <span className="chart-months__label">Open a month</span>
          <ul className="chart-months__list">
            {data.map((point) => (
              <li key={point.month}>
                <Link className="chart-months__link" href={monthHref(point.month)}>
                  {shortMonth(point.month)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
