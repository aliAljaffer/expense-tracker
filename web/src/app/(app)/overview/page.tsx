import type { Metadata } from "next";
import { OverviewContent } from "@/components/features/overview/OverviewContent";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default function OverviewPage() {
  return (
    <div className="overview-page">
      <div className="overview-section">
        <h1 className="overview-page__title">Overview</h1>
        <p className="overview-page__lede">
          Account balances and monthly spending summary.
        </p>
      </div>

      <OverviewContent />
    </div>
  );
}
