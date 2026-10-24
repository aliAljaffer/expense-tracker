import type { Metadata } from "next";
import { SuggestionsContent } from "@/components/features/suggestions/SuggestionsContent";

export const metadata: Metadata = { title: "Suggestions" };
export const dynamic = "force-dynamic";

export default function SuggestionsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-medium">Suggestions</h1>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Smart insights about your spending patterns and payment trends.
        </p>
      </div>

      <SuggestionsContent />
    </div>
  );
}
