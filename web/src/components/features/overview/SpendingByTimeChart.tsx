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
import type { TimeBucket } from "@/lib/api/types";
import {
  ChartCard,
  ChartEmpty,
  chartAxisProps,
  chartGridProps,
} from "@/components/ui/chart";

const hourTicks = [0, 3, 6, 9, 12, 15, 18, 21];

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function hourRange(hour: number): string {
  return `${hourLabel(hour)} to ${String(hour).padStart(2, "0")}:59`;
}

function axisMoney(halalas: number): string {
  const riyals = halalas / 100;
  if (riyals >= 1000) return `${Math.round(riyals / 1000)}k`;
  return String(Math.round(riyals));
}

function coverageLede(timed: number, untimed: number): string {
  const total = timed + untimed;
  if (total === 0) return "Debit in SAR by hour of day.";
  if (untimed === 0) {
    return `Debit in SAR by hour of day. Every spending row in this range carries a time.`;
  }
  return `Debit in SAR by hour of day. ${timed} of ${total} spending rows carry a time.`;
}

interface HourTooltipProps {
  active?: boolean;
  label?: string | number;
  points: TimeBucket[];
}

function HourTooltip({ active, label, points }: HourTooltipProps) {
  if (!active) return null;

  const point = points.find((entry) => entry.hour === Number(label));
  if (!point) return null;

  return (
    <div className="chart-tooltip" role="tooltip">
      <p className="chart-tooltip__label">{hourRange(point.hour)}</p>
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
    </div>
  );
}

export interface SpendingByTimeChartProps {
  data: { hours: TimeBucket[]; timed_count: number; untimed_count: number } | null;
  unavailable?: boolean;
}

export function SpendingByTimeChart({ data, unavailable }: SpendingByTimeChartProps) {
  const points = [...(data?.hours ?? [])].sort((a, b) => a.hour - b.hour);
  const timed = data?.timed_count ?? 0;
  const untimed = data?.untimed_count ?? 0;

  return (
    <ChartCard title="Spending by time" lede={coverageLede(timed, untimed)}>
      {unavailable ? (
        <ChartEmpty
          message="Spending by time unavailable"
          hint="The rest of the overview still loaded."
        />
      ) : timed === 0 ? (
        <ChartEmpty
          message="No transaction times yet"
          hint="Alinma exports list only the date. Al Rajhi statements include a time."
        />
      ) : (
        <div
          className="spending-time-chart__plot"
          role="group"
          aria-label="Debit by hour of day. Each bar is one hour from 00 to 23."
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={points}
              margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
              accessibilityLayer
            >
              <CartesianGrid {...chartGridProps} />
              <XAxis
                {...chartAxisProps}
                dataKey="hour"
                ticks={hourTicks}
                tickFormatter={hourLabel}
              />
              <YAxis
                {...chartAxisProps}
                width={48}
                tickCount={4}
                tickFormatter={axisMoney}
              />
              <Tooltip
                cursor={{ fill: "var(--color-surface-sunken)" }}
                content={<HourTooltip points={points} />}
              />
              <Bar
                dataKey="debit"
                name="Debit"
                fill="var(--color-chart-1)"
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  );
}
