import type { Metadata } from "next";
import { SuggestionsContent } from "@/components/features/suggestions/SuggestionsContent";

export const metadata: Metadata = { title: "Suggestions" };
export const dynamic = "force-dynamic";

export default function SuggestionsPage() {
  return (
    <div className="suggestions-page">
      <div className="overview-section">
        <h1 className="suggestions-page__title">Suggestions</h1>
        <p className="suggestions-page__lede">
          Smart insights about your spending patterns and payment trends.
        </p>
      </div>

      <SuggestionsContent />
    </div>
  );
}
