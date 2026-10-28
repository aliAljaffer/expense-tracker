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
import type { BnplResponse, SuggestionDecision } from "@/lib/api/types";
import { DismissedSuggestionCard } from "./DismissedSuggestionCard";
import { SuggestionDecisionBar } from "./SuggestionDecisionBar";
import {
  ChartCard,
  ChartEmpty,
  ChartTooltip,
  chartAxisProps,
  chartGridProps,
} from "@/components/ui/chart";

interface BnplTrendCardProps {
  data: BnplResponse;
  lead?: boolean;
  decision?: SuggestionDecision;
  onDecide?: (decision: SuggestionDecision) => Promise<void>;
}

function axisSAR(value: number): string {
  return String(Math.round(value / 100));
}

export function BnplTrendCard({
  data,
  lead = false,
  decision = "",
  onDecide = async () => {},
}: BnplTrendCardProps) {
  if (decision === "dismissed") {
    return <DismissedSuggestionCard title="BNPL trend" onDecide={onDecide} />;
  }

  if (data.status === "insufficient_data") {
    return (
      <div className="suggestion-card suggestion-card--insufficient-data">
        <div className="suggestion-card__header">
          <h3 className="suggestion-card__title">BNPL trend</h3>
          <p className="suggestion-card__summary">
            No BNPL commitments yet. Mark merchants as BNPL to track obligations.
          </p>
          <p className="suggestion-insufficient-data__reason">{data.next_step}</p>
        </div>
        <SuggestionDecisionBar decision={decision} onDecide={onDecide} />
      </div>
    );
  }

  const months = data.evidence.months;
  const chartMonths = [...months].sort((a, b) => a.month.localeCompare(b.month));

  return (
    <div className={`suggestion-card${lead ? " suggestion-card--lead" : ""}`}>
      <div className="suggestion-card__header">
        <h3 className="suggestion-card__title">BNPL trend</h3>
        <p className="suggestion-card__summary">{data.summary}</p>
      </div>

      <SuggestionDecisionBar decision={decision} onDecide={onDecide} />

      <div className="suggestion-card__body">
        <ChartCard
          title="Monthly outflow"
          lede="BNPL payments per month"
          className="suggestion-card__chart"
        >
          {chartMonths.length === 0 ? (
            <ChartEmpty message="No BNPL payments in this period" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartMonths} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid {...chartGridProps} />
                <XAxis dataKey="month" {...chartAxisProps} />
                <YAxis {...chartAxisProps} width={40} tickFormatter={axisSAR} />
                <Tooltip content={<ChartTooltip money />} />
                <Line
                  type="monotone"
                  dataKey="bnpl_outflow"
                  name="Outflow"
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
                  <th>Outflow</th>
                  <th>Prev</th>
                  <th>3-mo avg</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {months.map((month) => (
                  <tr key={month.month}>
                    <td>
                      <Link
                        href={`/overview/transactions?from=${month.month}-01&to=${month.month}-31`}
                        className="suggestion-card__link"
                      >
                        {month.month}
                      </Link>
                    </td>
                    <td>
                      {displaySAR(month.bnpl_outflow)}
                    </td>
                    <td>
                      {displaySAR(month.previous_month)}
                    </td>
                    <td>
                      {displaySAR(month.three_month_average)}
                    </td>
                    <td>
                      {month.is_rising ? "Rising" : "Normal"}
                    </td>
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
