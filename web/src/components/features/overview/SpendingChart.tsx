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
import { displaySAR } from "@/lib/api/types";
import type { Transaction } from "@/lib/api/types";
import {
  ChartCard,
  ChartEmpty,
  ChartTooltip,
  chartAxisProps,
  chartGridProps,
} from "@/components/ui/chart";

/** internal/ledger/store.go rejects a limit above this. */
export const CHART_ROW_LIMIT = 500;

export interface SpendingPoint {
  day: string;
  debit: number;
}

export function debitByDay(rows: Transaction[]): SpendingPoint[] {
  const totals = new Map<string, number>();

  for (const row of rows) {
    if (row.debit <= 0) continue;
    totals.set(row.posted_date, (totals.get(row.posted_date) ?? 0) + row.debit);
  }

  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, debit]) => ({ day, debit }));
}

function buildLede(from: string | undefined, to: string | undefined, shown: number, total: number) {
  const range = from && to ? `, ${from} to ${to}` : "";
  const capped =
    total > shown
      ? ` The newest ${shown} of ${total} rows in this range; earlier days are not plotted.`
      : "";
  return `Debit per day in SAR${range}.${capped}`;
}

function axisMoney(value: number) {
  return displaySAR(value).replace(" SAR", "");
}

export interface SpendingChartProps {
  rows: Transaction[];
  totalCount: number;
  from?: string;
  to?: string;
  unavailable?: boolean;
}

export function SpendingChart({ rows, totalCount, from, to, unavailable }: SpendingChartProps) {
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
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
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
              cursor={{ fill: "var(--color-surface-sunken)" }}
              content={<ChartTooltip money labelFormatter={(day) => String(day)} />}
            />
            <Bar
              dataKey="debit"
              name="Debit"
              fill="var(--color-chart-1)"
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
