"use client";

import type { SuggestionDecision } from "@/lib/api/types";
import { SuggestionDecisionBar } from "./SuggestionDecisionBar";

interface DismissedSuggestionCardProps {
  title: string;
  onDecide: (decision: SuggestionDecision) => Promise<void>;
}

export function DismissedSuggestionCard({ title, onDecide }: DismissedSuggestionCardProps) {
  return (
    <div className="suggestion-card suggestion-card--dismissed">
      <div className="suggestion-card__header">
        <h3 className="suggestion-card__title">{title}</h3>
        <p className="suggestion-card__summary">
          Dismissed. The data is still available.
        </p>
      </div>
      <SuggestionDecisionBar decision="dismissed" onDecide={onDecide} />
    </div>
  );
}
