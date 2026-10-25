"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { displaySAR } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const subscribeToNothing = () => () => {};

function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

export interface ChartCardProps {
  title: string;
  lede?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function ChartCard({ title, lede, action, children, className }: ChartCardProps) {
  const isClient = useIsClient();

  return (
    <section className={cn("chart-card", className)}>
      <header className="chart-card__header">
        <div>
          <h2 className="chart-card__title">{title}</h2>
          {lede ? <p className="chart-card__lede">{lede}</p> : null}
        </div>
        {action ? <div className="chart-card__action">{action}</div> : null}
      </header>
      <div className="chart-card__plot">{isClient ? children : null}</div>
    </section>
  );
}

export interface ChartEmptyProps {
  message?: string;
  hint?: string;
}

export function ChartEmpty({ message = "No data for this period", hint }: ChartEmptyProps) {
  return (
    <div className="chart-empty" role="status">
      <p className="chart-empty__message">{message}</p>
      {hint ? <p className="chart-empty__hint">{hint}</p> : null}
    </div>
  );
}

export interface ChartTooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string | number;
  /** true formats every value as money, an array formats the matching dataKeys. */
  money?: boolean | Array<string | number>;
  labelFormatter?: (label: string | number) => string;
}

function isMoney(entry: ChartTooltipEntry, money: ChartTooltipProps["money"]): boolean {
  if (money === true) return true;
  if (Array.isArray(money)) return money.includes(entry.dataKey ?? "");
  return false;
}

function formatValue(entry: ChartTooltipEntry, money: ChartTooltipProps["money"]): string {
  if (entry.value === undefined || entry.value === null) return "";
  if (isMoney(entry, money)) return displaySAR(Number(entry.value));
  return String(entry.value);
}

export function ChartTooltip({ active, payload, label, money, labelFormatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="chart-tooltip" role="tooltip">
      {label !== undefined ? (
        <p className="chart-tooltip__label">{labelFormatter ? labelFormatter(label) : label}</p>
      ) : null}
      <ul className="chart-tooltip__list">
        {payload.map((entry, index) => (
          <li className="chart-tooltip__row" key={`${entry.dataKey ?? entry.name ?? index}`}>
            {entry.color ? (
              <span
                aria-hidden="true"
                className="chart-tooltip__swatch"
                style={{ backgroundColor: entry.color }}
              />
            ) : null}
            <span className="chart-tooltip__name">{entry.name ?? entry.dataKey}</span>
            <span className="chart-tooltip__value">{formatValue(entry, money)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export const chartAxisProps = {
  stroke: "var(--color-chart-axis-line)",
  tick: { fill: "var(--color-chart-axis-label)", fontSize: "var(--text-xs)" },
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
};

export const chartGridProps = {
  stroke: "var(--color-border-default)",
  strokeDasharray: "0",
  horizontal: true,
  vertical: false,
};
