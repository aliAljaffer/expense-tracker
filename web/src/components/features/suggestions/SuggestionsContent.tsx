"use client";

import { useState, useEffect } from "react";
import {
  getCardCoverageSuggestion,
  getRecurringSuggestion,
  getBnplSuggestion,
  getSalaryTrendSuggestion,
  getTransferMatchesSuggestion,
  setSuggestionDecision,
  clearSuggestionDecision,
} from "@/lib/api/suggestions";
import type {
  CardCoverageResponse,
  RecurringResponse,
  BnplResponse,
  SalaryTrendResponse,
  TransferMatchesResponse,
  SuggestionDecision,
  SuggestionKind,
} from "@/lib/api/types";
import { CreditCardCoverageCard } from "./CreditCardCoverageCard";
import { RecurringPaymentsCard } from "./RecurringPaymentsCard";
import { BnplTrendCard } from "./BnplTrendCard";
import { SalaryTrendCard } from "./SalaryTrendCard";
import { TransferMatchesCard } from "./TransferMatchesCard";

type LeadSuggestion = "coverage" | "recurring" | "bnpl" | "salary" | "transfers" | null;

const emptyDecisions: Record<SuggestionKind, SuggestionDecision> = {
  "card-coverage": "",
  recurring: "",
  bnpl: "",
  "salary-trend": "",
  "transfer-matches": "",
};

export function leadSuggestion(
  cardCoverage: CardCoverageResponse,
  recurring: RecurringResponse,
  bnpl: BnplResponse,
  salaryTrend: SalaryTrendResponse,
  transferMatches: TransferMatchesResponse
): LeadSuggestion {
  if (cardCoverage.status === "ok" && cardCoverage.decision !== "dismissed") return "coverage";
  if (recurring.status === "ok" && recurring.decision !== "dismissed") return "recurring";
  if (bnpl.status === "ok" && bnpl.decision !== "dismissed") return "bnpl";
  if (salaryTrend.status === "ok" && salaryTrend.decision !== "dismissed") return "salary";
  if (transferMatches.status === "ok" && transferMatches.decision !== "dismissed") {
    return "transfers";
  }
  return null;
}

export function SuggestionsContent() {
  const [cardCoverage, setCardCoverage] = useState<CardCoverageResponse | null>(null);
  const [recurring, setRecurring] = useState<RecurringResponse | null>(null);
  const [bnpl, setBnpl] = useState<BnplResponse | null>(null);
  const [salaryTrend, setSalaryTrend] = useState<SalaryTrendResponse | null>(null);
  const [transferMatches, setTransferMatches] = useState<TransferMatchesResponse | null>(null);
  const [decisions, setDecisions] =
    useState<Record<SuggestionKind, SuggestionDecision>>(emptyDecisions);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSuggestions() {
      try {
        setIsLoading(true);
        setError(null);

        const results = await Promise.allSettled([
          getCardCoverageSuggestion(),
          getRecurringSuggestion(),
          getBnplSuggestion(),
          getSalaryTrendSuggestion(),
          getTransferMatchesSuggestion(),
        ]);
        const [coverage, recur, bnplData, salary, transfers] = results;

        const next = { ...emptyDecisions };
        if (coverage.status === "fulfilled") {
          setCardCoverage(coverage.value);
          next["card-coverage"] = coverage.value.decision ?? "";
        }
        if (recur.status === "fulfilled") {
          setRecurring(recur.value);
          next.recurring = recur.value.decision ?? "";
        }
        if (bnplData.status === "fulfilled") {
          setBnpl(bnplData.value);
          next.bnpl = bnplData.value.decision ?? "";
        }
        if (salary.status === "fulfilled") {
          setSalaryTrend(salary.value);
          next["salary-trend"] = salary.value.decision ?? "";
        }
        if (transfers.status === "fulfilled") {
          setTransferMatches(transfers.value);
          next["transfer-matches"] = transfers.value.decision ?? "";
        }
        setDecisions(next);

        const loaded = results.filter((result) => result.status === "fulfilled").length;
        if (loaded === 0) {
          setError("Failed to load suggestions");
        } else if (loaded < results.length) {
          setNotice("Some suggestions could not load. The rest are shown below.");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load suggestions";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }

    loadSuggestions();
  }, []);

  async function decide(kind: SuggestionKind, next: SuggestionDecision) {
    const previous = decisions[kind];
    setDecisions((current) => ({ ...current, [kind]: next }));
    try {
      if (next === "") {
        await clearSuggestionDecision(kind);
      } else {
        await setSuggestionDecision(kind, next);
      }
    } catch (err) {
      setDecisions((current) => ({ ...current, [kind]: previous }));
      throw err;
    }
  }

  if (isLoading) {
    return <div className="stack--normal">Loading...</div>;
  }

  if (error) {
    return (
      <div className="overview-error-box">
        <div className="overview-error-icon">
          <svg viewBox="0 0 20 20" fill="currentColor" width="24" height="24">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="overview-error-content">
          <h2 className="overview-error-title">Failed to load suggestions</h2>
          <p className="overview-error-text">{error}</p>
        </div>
      </div>
    );
  }

  if (!cardCoverage && !recurring && !bnpl && !salaryTrend && !transferMatches) {
    return null;
  }

  const lead =
    cardCoverage && recurring && bnpl && salaryTrend && transferMatches
      ? leadSuggestion(
          { ...cardCoverage, decision: decisions["card-coverage"] },
          { ...recurring, decision: decisions.recurring },
          { ...bnpl, decision: decisions.bnpl },
          { ...salaryTrend, decision: decisions["salary-trend"] },
          { ...transferMatches, decision: decisions["transfer-matches"] }
        )
      : null;

  return (
    <>
      {notice && (
        <p className="note" role="status">
          {notice}
        </p>
      )}
      <div className="suggestions-cards">
        {cardCoverage && (
          <CreditCardCoverageCard
            data={cardCoverage}
            lead={lead === "coverage"}
            decision={decisions["card-coverage"]}
            onDecide={(next) => decide("card-coverage", next)}
          />
        )}
        {recurring && (
          <RecurringPaymentsCard
            data={recurring}
            lead={lead === "recurring"}
            decision={decisions.recurring}
            onDecide={(next) => decide("recurring", next)}
          />
        )}
        {bnpl && (
          <BnplTrendCard
            data={bnpl}
            lead={lead === "bnpl"}
            decision={decisions.bnpl}
            onDecide={(next) => decide("bnpl", next)}
          />
        )}
        {salaryTrend && (
          <SalaryTrendCard
            data={salaryTrend}
            lead={lead === "salary"}
            decision={decisions["salary-trend"]}
            onDecide={(next) => decide("salary-trend", next)}
          />
        )}
        {transferMatches && (
          <TransferMatchesCard
            data={transferMatches}
            lead={lead === "transfers"}
            decision={decisions["transfer-matches"]}
            onDecide={(next) => decide("transfer-matches", next)}
          />
        )}
      </div>
    </>
  );
}
