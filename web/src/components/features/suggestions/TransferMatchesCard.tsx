"use client";

import Link from "next/link";
import { displaySAR } from "@/lib/api/types";
import type { TransferMatchesResponse, SuggestionDecision } from "@/lib/api/types";
import { DismissedSuggestionCard } from "./DismissedSuggestionCard";
import { SuggestionDecisionBar } from "./SuggestionDecisionBar";

interface TransferMatchesCardProps {
  data: TransferMatchesResponse;
  lead?: boolean;
  decision?: SuggestionDecision;
  onDecide?: (decision: SuggestionDecision) => Promise<void>;
}

export function TransferMatchesCard({
  data,
  lead = false,
  decision = "",
  onDecide = async () => {},
}: TransferMatchesCardProps) {
  if (decision === "dismissed") {
    return <DismissedSuggestionCard title="Transfer matches" onDecide={onDecide} />;
  }

  if (data.status === "insufficient_data") {
    return (
      <div className="suggestion-card suggestion-card--insufficient-data">
        <div className="suggestion-card__header">
          <h3 className="suggestion-card__title">Transfer matches</h3>
          <p className="suggestion-card__summary">
            No likely internal transfers yet. Import statements for your other accounts.
          </p>
          <p className="suggestion-insufficient-data__reason">{data.next_step}</p>
        </div>
        <SuggestionDecisionBar decision={decision} onDecide={onDecide} />
      </div>
    );
  }

  const matches = data.evidence.matches;

  return (
    <div className={`suggestion-card${lead ? " suggestion-card--lead" : ""}`}>
      <div className="suggestion-card__header">
        <h3 className="suggestion-card__title">Transfer matches</h3>
        <p className="suggestion-card__summary">{data.summary}</p>
      </div>

      <SuggestionDecisionBar decision={decision} onDecide={onDecide} />

      <div className="suggestion-card__body">
        <div className="suggestion-card__period">
          Period: {data.period.from} to {data.period.to}
        </div>

        {matches.length > 0 && (
          <div className="suggestion-card__table-wrapper">
            <table className="suggestion-card__table">
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Debit</th>
                  <th>Credit</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => (
                  <tr key={`${match.debit_transaction_id}-${match.credit_transaction_id}`}>
                    <td>{displaySAR(match.amount)}</td>
                    <td>
                      <Link
                        href={`/overview/transactions?from=${match.debit_date}&to=${match.credit_date}&bucket=transfers`}
                        className="suggestion-card__link"
                      >
                        {match.debit_date}
                      </Link>
                      <span className="suggestion-card__account">{match.debit_account}</span>
                    </td>
                    <td>
                      {match.credit_date}
                      <span className="suggestion-card__account">{match.credit_account}</span>
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
