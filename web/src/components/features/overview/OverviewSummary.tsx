"use client";

import { displaySAR } from "@/lib/api/types";
import type { MonthlyOverview } from "@/lib/api/types";

const monthFormat = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function latestMonth(months: MonthlyOverview[]): MonthlyOverview | null {
  if (months.length === 0) return null;
  return months.reduce((latest, month) =>
    month.month > latest.month ? month : latest,
  );
}

export function formatSignedSAR(halalas: number): string {
  if (halalas < 0) return `-${displaySAR(Math.abs(halalas))}`;
  return displaySAR(halalas);
}

export function OverviewSummary({ months }: { months: MonthlyOverview[] }) {
  const month = latestMonth(months);
  if (!month) return null;

  const period = monthFormat.format(new Date(`${month.month}-01T00:00:00Z`));
  const net = month.income.total - month.outflow_total;

  return (
    <section className="overview-summary" aria-labelledby="overview-summary-heading">
      <h2 id="overview-summary-heading" className="visually-hidden">
        Latest month
      </h2>
      <div>
        <p className="overview-summary__label">Money out in {period}</p>
        <p className="overview-summary__value">{displaySAR(month.outflow_total)}</p>
        <p className="overview-summary__note">
          Spending, transfers, and card payments combined.
        </p>
      </div>
      <dl className="overview-summary__figures">
        <div>
          <dt className="overview-summary__label">Income</dt>
          <dd className="overview-figure__value">{displaySAR(month.income.total)}</dd>
        </div>
        <div>
          <dt className="overview-summary__label">Net</dt>
          <dd className="overview-figure__value">{formatSignedSAR(net)}</dd>
        </div>
      </dl>
    </section>
  );
}
