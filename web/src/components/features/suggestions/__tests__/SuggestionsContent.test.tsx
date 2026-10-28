import { describe, it, expect } from "vitest";
import { leadSuggestion } from "../SuggestionsContent";
import type {
  CardCoverageResponse,
  RecurringResponse,
  BnplResponse,
  SalaryTrendResponse,
  TransferMatchesResponse,
  SuggestionDecision,
} from "@/lib/api/types";

const withStatus = (status: string, decision: SuggestionDecision = "") => ({
  status,
  decision,
});

const coverage = (status: string, decision: SuggestionDecision = "") =>
  withStatus(status, decision) as unknown as CardCoverageResponse;
const recurring = (status: string, decision: SuggestionDecision = "") =>
  withStatus(status, decision) as unknown as RecurringResponse;
const bnpl = (status: string, decision: SuggestionDecision = "") =>
  withStatus(status, decision) as unknown as BnplResponse;
const salary = (status: string, decision: SuggestionDecision = "") =>
  withStatus(status, decision) as unknown as SalaryTrendResponse;
const transfers = (status: string, decision: SuggestionDecision = "") =>
  withStatus(status, decision) as unknown as TransferMatchesResponse;

describe("leadSuggestion", () => {
  it("leads with the first card that has data", () => {
    expect(
      leadSuggestion(coverage("ok"), recurring("ok"), bnpl("ok"), salary("ok"), transfers("ok"))
    ).toBe("coverage");
    expect(
      leadSuggestion(
        coverage("insufficient_data"),
        recurring("ok"),
        bnpl("ok"),
        salary("ok"),
        transfers("ok")
      )
    ).toBe("recurring");
    expect(
      leadSuggestion(
        coverage("insufficient_data"),
        recurring("insufficient_data"),
        bnpl("ok"),
        salary("ok"),
        transfers("ok")
      )
    ).toBe("bnpl");
  });

  it("gives salary and transfers a turn after the first three", () => {
    expect(
      leadSuggestion(
        coverage("insufficient_data"),
        recurring("insufficient_data"),
        bnpl("insufficient_data"),
        salary("ok"),
        transfers("ok")
      )
    ).toBe("salary");
    expect(
      leadSuggestion(
        coverage("insufficient_data"),
        recurring("insufficient_data"),
        bnpl("insufficient_data"),
        salary("insufficient_data"),
        transfers("ok")
      )
    ).toBe("transfers");
  });

  it("skips a dismissed card", () => {
    expect(
      leadSuggestion(
        coverage("ok", "dismissed"),
        recurring("ok"),
        bnpl("ok"),
        salary("ok"),
        transfers("ok")
      )
    ).toBe("recurring");
  });

  it("returns null when no card has data", () => {
    expect(
      leadSuggestion(
        coverage("insufficient_data"),
        recurring("insufficient_data"),
        bnpl("insufficient_data"),
        salary("insufficient_data"),
        transfers("insufficient_data")
      )
    ).toBeNull();
  });
});
