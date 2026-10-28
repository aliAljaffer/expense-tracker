"use client";

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
import type { Transaction } from "@/lib/api/types";
import {
  ChartCard,
  ChartEmpty,
  chartAxisProps,
  chartGridProps,
} from "@/components/ui/chart";

/** internal/ledger/store.go rejects a limit above this. */
export const CHART_ROW_LIMIT = 500;

export interface SpendingPoint {
  day: string;
  debit: number;
  count: number;
}

const dayFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function formatDay(day: string): string {
  return dayFormat.format(new Date(`${day}T00:00:00Z`));
}

export function debitByDay(rows: Transaction[]): SpendingPoint[] {
  const totals = new Map<string, { debit: number; count: number }>();

  for (const row of rows) {
    if (row.debit <= 0) continue;
    const current = totals.get(row.posted_date) ?? { debit: 0, count: 0 };
    totals.set(row.posted_date, {
      debit: current.debit + row.debit,
      count: current.count + 1,
    });
  }

  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, total]) => ({ day, debit: total.debit, count: total.count }));
}

function buildLede(from: string | undefined, to: string | undefined, shown: number, total: number) {
  const range = from && to ? `, ${from} to ${to}` : "";
  const capped =
    total > shown
      ? ` The newest ${shown} of ${total} rows in this range; earlier days are not plotted.`
      : "";
  return `Debit per day in SAR${range}. Select a day to filter the table.${capped}`;
}

function axisMoney(value: number) {
  return displaySAR(value).replace(" SAR", "");
}

interface SpendingTooltipProps {
  active?: boolean;
  label?: string | number;
  points: SpendingPoint[];
}

function SpendingTooltip({ active, label, points }: SpendingTooltipProps) {
  if (!active) return null;

  const point = points.find((entry) => entry.day === String(label));
  if (!point) return null;

  return (
    <div className="chart-tooltip" role="tooltip">
      <p className="chart-tooltip__label">{formatDay(point.day)}</p>
      <ul className="chart-tooltip__list">
        <li className="chart-tooltip__row">
          <span
            aria-hidden="true"
            className="chart-tooltip__swatch"
            style={{ backgroundColor: "var(--color-chart-1)" }}
          />
          <span className="chart-tooltip__name">Debit</span>
          <span className="chart-tooltip__value">{displaySAR(point.debit)}</span>
        </li>
        <li className="chart-tooltip__row">
          <span className="chart-tooltip__name">Transactions</span>
          <span className="chart-tooltip__value">{point.count}</span>
        </li>
      </ul>
      <p className="chart-tooltip__hint">Select to filter this day.</p>
    </div>
  );
}

export interface SpendingChartProps {
  rows: Transaction[];
  totalCount: number;
  from?: string;
  to?: string;
  unavailable?: boolean;
  onSelectDay?: (day: string) => void;
}

export function SpendingChart({
  rows,
  totalCount,
  from,
  to,
  unavailable,
  onSelectDay,
}: SpendingChartProps) {
  const points = debitByDay(rows);

  return (
    <ChartCard title="Spending over time" lede={buildLede(from, to, rows.length, totalCount)}>
      {unavailable ? (
        <ChartEmpty message="Spending chart unavailable" hint="The transactions table still loaded." />
      ) : points.length === 0 ? (
        <ChartEmpty
          message="No spending in this range"
          hint="Adjust the dates or import a statement to see daily debits."
        />
      ) : (
        <div
          className="spending-chart__plot"
          role="group"
          aria-label="Debit per day. Select a day to filter the transactions table."
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={points}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              accessibilityLayer
              onClick={(state) => {
                if (!onSelectDay || typeof state.activeLabel !== "string") return;
                onSelectDay(state.activeLabel);
              }}
            >
              <CartesianGrid {...chartGridProps} />
              <XAxis
                {...chartAxisProps}
                dataKey="day"
                minTickGap={12}
                tickFormatter={(day: string) => day.slice(8)}
              />
              <YAxis
                {...chartAxisProps}
                width={72}
                tickCount={4}
                tickFormatter={axisMoney}
              />
              <Tooltip
                cursor={{ stroke: "var(--color-border-strong)", strokeWidth: 1 }}
                content={<SpendingTooltip points={points} />}
              />
              <Area
                type="monotone"
                dataKey="debit"
                name="Debit"
                stroke="var(--color-chart-1)"
                fill="var(--color-chart-1)"
                fillOpacity={0.18}
                strokeWidth={2}
                activeDot={{ r: 4, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
