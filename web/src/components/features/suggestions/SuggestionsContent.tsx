"use client";

import { useState, useEffect } from "react";
import { getCardCoverageSuggestion, getRecurringSuggestion, getBnplSuggestion } from "@/lib/api/suggestions";
import type { CardCoverageResponse, RecurringResponse, BnplResponse } from "@/lib/api/types";
import { CreditCardCoverageCard } from "./CreditCardCoverageCard";
import { RecurringPaymentsCard } from "./RecurringPaymentsCard";
import { BnplTrendCard } from "./BnplTrendCard";

export function SuggestionsContent() {
  const [cardCoverage, setCardCoverage] = useState<CardCoverageResponse | null>(null);
  const [recurring, setRecurring] = useState<RecurringResponse | null>(null);
  const [bnpl, setBnpl] = useState<BnplResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSuggestions() {
      try {
        setIsLoading(true);
        setError(null);

        const [coverage, recur, bnplData] = await Promise.all([
          getCardCoverageSuggestion(),
          getRecurringSuggestion(),
          getBnplSuggestion(),
        ]);

        setCardCoverage(coverage);
        setRecurring(recur);
        setBnpl(bnplData);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load suggestions";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    loadSuggestions();
  }, []);

  if (isLoading) {
    return <div className="space-y-6">Loading...</div>;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-[var(--color-feedback-error-border)] bg-[var(--color-feedback-error-bg)] p-6">
        <div className="flex gap-3">
          <div className="flex-shrink-0 text-[var(--color-feedback-error-icon)]">
            <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div>
            <h2 className="font-medium text-[var(--color-feedback-error-text)]">Failed to load suggestions</h2>
            <p className="mt-1 text-sm text-[var(--color-feedback-error-text)]">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!cardCoverage || !recurring || !bnpl) {
    return null;
  }

  return (
    <div className="space-y-6">
      <CreditCardCoverageCard data={cardCoverage} />
      <RecurringPaymentsCard data={recurring} />
      <BnplTrendCard data={bnpl} />
    </div>
  );
}
