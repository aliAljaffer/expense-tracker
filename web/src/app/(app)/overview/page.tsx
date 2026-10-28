import type { Metadata } from "next";
import { OverviewContent } from "@/components/features/overview/OverviewContent";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default function OverviewPage() {
  return (
    <div className="overview-page">
      <div className="page__intro">
        <p className="eyebrow">Overview</p>
        <h1 className="display">Money in, money out.</h1>
        <p className="lede">
          Balances from your imported statements, with income and outflow for
          each month.
        </p>
      </div>

      <OverviewContent />
    </div>
  );
}
