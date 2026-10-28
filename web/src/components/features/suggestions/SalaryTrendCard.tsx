"use client";

import Link from "next/link";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { displaySAR } from "@/lib/api/types";
import type { SalaryTrendResponse, SuggestionDecision } from "@/lib/api/types";
import {
  ChartCard,
  ChartEmpty,
  ChartTooltip,
  chartAxisProps,
  chartGridProps,
} from "@/components/ui/chart";
import { DismissedSuggestionCard } from "./DismissedSuggestionCard";
import { SuggestionDecisionBar } from "./SuggestionDecisionBar";

interface SalaryTrendCardProps {
  data: SalaryTrendResponse;
  lead?: boolean;
  decision?: SuggestionDecision;
  onDecide?: (decision: SuggestionDecision) => Promise<void>;
}

function axisSAR(value: number): string {
  return String(Math.round(value / 100));
}

export function SalaryTrendCard({
  data,
  lead = false,
  decision = "",
  onDecide = async () => {},
}: SalaryTrendCardProps) {
  if (decision === "dismissed") {
    return <DismissedSuggestionCard title="Salary trend" onDecide={onDecide} />;
  }

  if (data.status === "insufficient_data") {
    return (
      <div className="suggestion-card suggestion-card--insufficient-data">
        <div className="suggestion-card__header">
          <h3 className="suggestion-card__title">Salary trend</h3>
          <p className="suggestion-card__summary">
            Not enough salary months yet. Import statements to compare income.
          </p>
          <p className="suggestion-insufficient-data__reason">{data.next_step}</p>
        </div>
        <SuggestionDecisionBar decision={decision} onDecide={onDecide} />
      </div>
    );
  }

  const months = data.evidence.months;

  return (
    <div className={`suggestion-card${lead ? " suggestion-card--lead" : ""}`}>
      <div className="suggestion-card__header">
        <h3 className="suggestion-card__title">Salary trend</h3>
        <p className="suggestion-card__summary">{data.summary}</p>
      </div>

      <SuggestionDecisionBar decision={decision} onDecide={onDecide} />

      <div className="suggestion-card__body">
        <ChartCard
          title="Monthly salary"
          lede="Salary deposits per month"
          className="suggestion-card__chart"
        >
          {months.length === 0 ? (
            <ChartEmpty message="No salary deposits in this period" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={months} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="month" {...chartAxisProps} />
                <YAxis {...chartAxisProps} width={40} tickFormatter={axisSAR} />
                <Tooltip content={<ChartTooltip money />} />
                <Line
                  type="monotone"
                  dataKey="salary_total"
                  name="Salary"
                  stroke="var(--color-chart-1)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <div className="suggestion-card__period">
          Period: {data.period.from} to {data.period.to}
        </div>

        {months.length > 0 && (
          <div className="suggestion-card__table-wrapper">
            <table className="suggestion-card__table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Salary</th>
                  <th>Deposits</th>
                </tr>
              </thead>
              <tbody>
                {months.map((month) => (
                  <tr key={month.month}>
                    <td>
                      <Link
                        href={`/overview/transactions?from=${month.month}-01&to=${month.month}-31&kind=salary`}
                        className="suggestion-card__link"
                      >
                        {month.month}
                      </Link>
                    </td>
                    <td>{displaySAR(month.salary_total)}</td>
                    <td>{month.deposit_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="suggestion-card__footer">
          <div className="suggestion-card__footer-section">
            <p className="suggestion-card__footer-label">Limits</p>
            <p className="suggestion-card__footer-text">{data.limits}</p>
          </div>
          <div className="suggestion-card__footer-section">
            <p className="suggestion-card__footer-label">Next step</p>
            <p className="suggestion-card__footer-text">{data.next_step}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
