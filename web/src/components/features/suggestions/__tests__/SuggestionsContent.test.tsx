import { describe, it, expect } from "vitest";
import { leadSuggestion } from "../SuggestionsContent";
import type { CardCoverageResponse, RecurringResponse, BnplResponse } from "@/lib/api/types";

const coverage = (status: string) => ({ status }) as unknown as CardCoverageResponse;
const recurring = (status: string) => ({ status }) as unknown as RecurringResponse;
const bnpl = (status: string) => ({ status }) as unknown as BnplResponse;

describe("leadSuggestion", () => {
  it("leads with the first card that has data", () => {
    expect(leadSuggestion(coverage("ok"), recurring("ok"), bnpl("ok"))).toBe("coverage");
    expect(leadSuggestion(coverage("insufficient_data"), recurring("ok"), bnpl("ok"))).toBe(
      "recurring"
    );
    expect(
      leadSuggestion(coverage("insufficient_data"), recurring("insufficient_data"), bnpl("ok"))
    ).toBe("bnpl");
  });

  it("returns null when no card has data", () => {
    expect(
      leadSuggestion(
        coverage("insufficient_data"),
        recurring("insufficient_data"),
        bnpl("insufficient_data")
      )
    ).toBeNull();
  });
});
