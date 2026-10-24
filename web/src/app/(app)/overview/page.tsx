import type { Metadata } from "next";
import { OverviewContent } from "@/components/features/overview/OverviewContent";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

export default function OverviewPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-medium">Overview</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Account balances and monthly spending summary.
        </p>
      </div>

      <OverviewContent />
    </div>
  );
}
