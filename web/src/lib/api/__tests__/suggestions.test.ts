import { describe, it, expect, beforeEach, vi } from "vitest";
import { validateCardCoverageResponse, validateRecurringResponse, validateBnplResponse } from "../suggestions";
import type { CardCoverageResponse, RecurringResponse, BnplResponse } from "../types";

describe("Suggestion response validation", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  describe("validateCardCoverageResponse", () => {
    it("accepts valid ok response", () => {
      const data: CardCoverageResponse = {
        status: "ok",
        period: { from: "2026-02", to: "2026-12" },
        summary: "Seven of twelve months had card payments.",
        evidence: { months: [] },
        limits: "Does not account for manual entries.",
        next_step: "Import the card statement.",
      };

      expect(() => validateCardCoverageResponse(data)).not.toThrow();
    });

    it("accepts valid insufficient_data response", () => {
      const data: CardCoverageResponse = {
        status: "insufficient_data",
        period: { from: "2026-01", to: "2026-01" },
        summary: "Not enough data",
        evidence: { months: [] },
        limits: "Requires card payments",
        next_step: "Import statements",
      };

      expect(() => validateCardCoverageResponse(data)).not.toThrow();
    });

    it("rejects missing status", () => {
      const data = {
        period: { from: "2026-02", to: "2026-12" },
        summary: "Test",
        evidence: { months: [] },
        limits: "Test",
        next_step: "Test",
      };

      expect(() => validateCardCoverageResponse(data)).toThrow();
    });

    it("rejects missing period", () => {
      const data = {
        status: "ok",
        summary: "Test",
        evidence: { months: [] },
        limits: "Test",
        next_step: "Test",
      };

      expect(() => validateCardCoverageResponse(data)).toThrow();
    });

    it("rejects missing summary", () => {
      const data = {
        status: "ok",
        period: { from: "2026-02", to: "2026-12" },
        evidence: { months: [] },
        limits: "Test",
        next_step: "Test",
      };

      expect(() => validateCardCoverageResponse(data)).toThrow();
    });

    it("rejects missing limits", () => {
      const data = {
        status: "ok",
        period: { from: "2026-02", to: "2026-12" },
        summary: "Test",
        evidence: { months: [] },
        next_step: "Test",
      };

      expect(() => validateCardCoverageResponse(data)).toThrow();
    });

    it("rejects missing next_step", () => {
      const data = {
        status: "ok",
        period: { from: "2026-02", to: "2026-12" },
        summary: "Test",
        evidence: { months: [] },
        limits: "Test",
      };

      expect(() => validateCardCoverageResponse(data)).toThrow();
    });

    it("rejects invalid status value", () => {
      const data = {
        status: "invalid",
        period: { from: "2026-02", to: "2026-12" },
        summary: "Test",
        evidence: { months: [] },
        limits: "Test",
        next_step: "Test",
      };

      expect(() => validateCardCoverageResponse(data)).toThrow();
    });
  });

  describe("validateRecurringResponse", () => {
    it("accepts valid ok response", () => {
      const data: RecurringResponse = {
        status: "ok",
        period: { from: "2026-02", to: "2026-12" },
        summary: "Nine recurring payments found.",
        evidence: { recurring_series: [] },
        limits: "Requires 3 months minimum.",
        next_step: "Review payments.",
      };

      expect(() => validateRecurringResponse(data)).not.toThrow();
    });

    it("accepts valid insufficient_data response", () => {
      const data: RecurringResponse = {
        status: "insufficient_data",
        period: { from: "2026-01", to: "2026-01" },
        summary: "Not enough data",
        evidence: { recurring_series: [] },
        limits: "Requires 3 months",
        next_step: "Import more",
      };

      expect(() => validateRecurringResponse(data)).not.toThrow();
    });

    it("rejects missing status", () => {
      const data = {
        period: { from: "2026-02", to: "2026-12" },
        summary: "Test",
        evidence: { recurring_series: [] },
        limits: "Test",
        next_step: "Test",
      };

      expect(() => validateRecurringResponse(data)).toThrow();
    });
  });

  describe("validateBnplResponse", () => {
    it("accepts valid ok response", () => {
      const data: BnplResponse = {
        status: "ok",
        period: { from: "2026-01", to: "2026-12" },
        summary: "BNPL commitments are rising.",
        evidence: { months: [] },
        limits: "Requires manual BNPL marking.",
        next_step: "Review dates.",
      };

      expect(() => validateBnplResponse(data)).not.toThrow();
    });

    it("accepts valid insufficient_data response", () => {
      const data: BnplResponse = {
        status: "insufficient_data",
        period: { from: "2026-01", to: "2026-01" },
        summary: "Not enough data",
        evidence: { months: [] },
        limits: "No BNPL",
        next_step: "Mark merchants",
      };

      expect(() => validateBnplResponse(data)).not.toThrow();
    });

    it("rejects missing status", () => {
      const data = {
        period: { from: "2026-01", to: "2026-12" },
        summary: "Test",
        evidence: { months: [] },
        limits: "Test",
        next_step: "Test",
      };

      expect(() => validateBnplResponse(data)).toThrow();
    });
  });
});
