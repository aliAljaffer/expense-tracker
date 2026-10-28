import {
  CardCoverageResponse,
  RecurringResponse,
  BnplResponse,
  SalaryTrendResponse,
  TransferMatchesResponse,
  SuggestionKind,
} from "./types";

export interface GetSuggestionsParams {
  from?: string;
  to?: string;
}

export async function getCardCoverageSuggestion(
  params?: GetSuggestionsParams
): Promise<CardCoverageResponse> {
  const url = new URL("/api/bff/suggestions/card-coverage", window.location.origin);

  if (params?.from) url.searchParams.set("from", params.from);
  if (params?.to) url.searchParams.set("to", params.to);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error("Failed to fetch card coverage suggestion");
  }

  const data = await response.json();
  validateCardCoverageResponse(data);
  return data;
}

export async function getRecurringSuggestion(
  params?: GetSuggestionsParams
): Promise<RecurringResponse> {
  const url = new URL("/api/bff/suggestions/recurring", window.location.origin);

  if (params?.from) url.searchParams.set("from", params.from);
  if (params?.to) url.searchParams.set("to", params.to);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error("Failed to fetch recurring suggestion");
  }

  const data = await response.json();
  validateRecurringResponse(data);
  return data;
}

export async function getBnplSuggestion(
  params?: GetSuggestionsParams
): Promise<BnplResponse> {
  const url = new URL("/api/bff/suggestions/bnpl", window.location.origin);

  if (params?.from) url.searchParams.set("from", params.from);
  if (params?.to) url.searchParams.set("to", params.to);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error("Failed to fetch BNPL suggestion");
  }

  const data = await response.json();
  validateBnplResponse(data);
  return data;
}

export function validateCardCoverageResponse(data: unknown): asserts data is CardCoverageResponse {
  if (!data || typeof data !== "object") throw new Error("Invalid response");
  const obj = data as Record<string, unknown>;

  if (!obj.status || (obj.status !== "ok" && obj.status !== "insufficient_data")) {
    throw new Error("Missing or invalid status");
  }
  if (!obj.period || typeof obj.period !== "object") throw new Error("Missing period");
  if (!obj.summary || typeof obj.summary !== "string") throw new Error("Missing summary");
  if (!obj.limits || typeof obj.limits !== "string") throw new Error("Missing limits");
  if (!obj.next_step || typeof obj.next_step !== "string") throw new Error("Missing next_step");
  validateDecision(obj);

  if (obj.status === "ok") {
    if (!obj.evidence || typeof obj.evidence !== "object") throw new Error("Missing evidence");
  }
}

export function validateRecurringResponse(data: unknown): asserts data is RecurringResponse {
  if (!data || typeof data !== "object") throw new Error("Invalid response");
  const obj = data as Record<string, unknown>;

  if (!obj.status || (obj.status !== "ok" && obj.status !== "insufficient_data")) {
    throw new Error("Missing or invalid status");
  }
  if (!obj.period || typeof obj.period !== "object") throw new Error("Missing period");
  if (!obj.summary || typeof obj.summary !== "string") throw new Error("Missing summary");
  if (!obj.limits || typeof obj.limits !== "string") throw new Error("Missing limits");
  if (!obj.next_step || typeof obj.next_step !== "string") throw new Error("Missing next_step");
  validateDecision(obj);

  if (obj.status === "ok") {
    if (!obj.evidence || typeof obj.evidence !== "object") throw new Error("Missing evidence");
  }
}

export function validateBnplResponse(data: unknown): asserts data is BnplResponse {
  if (!data || typeof data !== "object") throw new Error("Invalid response");
  const obj = data as Record<string, unknown>;

  if (!obj.status || (obj.status !== "ok" && obj.status !== "insufficient_data")) {
    throw new Error("Missing or invalid status");
  }
  if (!obj.period || typeof obj.period !== "object") throw new Error("Missing period");
  if (!obj.summary || typeof obj.summary !== "string") throw new Error("Missing summary");
  if (!obj.limits || typeof obj.limits !== "string") throw new Error("Missing limits");
  if (!obj.next_step || typeof obj.next_step !== "string") throw new Error("Missing next_step");
  validateDecision(obj);

  if (obj.status === "ok") {
    if (!obj.evidence || typeof obj.evidence !== "object") throw new Error("Missing evidence");
  }
}

function validateDecision(obj: Record<string, unknown>): void {
  if (obj.decision === undefined) return;
  if (obj.decision !== "" && obj.decision !== "acknowledged" && obj.decision !== "dismissed") {
    throw new Error("Invalid decision");
  }
}

async function getSuggestion(path: string, label: string, params?: GetSuggestionsParams) {
  const url = new URL(`/api/bff/suggestions/${path}`, window.location.origin);
  if (params?.from) url.searchParams.set("from", params.from);
  if (params?.to) url.searchParams.set("to", params.to);
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch ${label} suggestion`);
  }
  return response.json();
}

export async function getSalaryTrendSuggestion(
  params?: GetSuggestionsParams
): Promise<SalaryTrendResponse> {
  const data = await getSuggestion("salary-trend", "salary trend", params);
  validateSalaryTrendResponse(data);
  return data;
}

export async function getTransferMatchesSuggestion(
  params?: GetSuggestionsParams
): Promise<TransferMatchesResponse> {
  const data = await getSuggestion("transfer-matches", "transfer matches", params);
  validateTransferMatchesResponse(data);
  return data;
}

function validateSuggestionShape(obj: Record<string, unknown>): void {
  if (obj.status !== "ok" && obj.status !== "insufficient_data") {
    throw new Error("Missing or invalid status");
  }
  if (!obj.period || typeof obj.period !== "object") throw new Error("Missing period");
  if (!obj.summary || typeof obj.summary !== "string") throw new Error("Missing summary");
  if (!obj.limits || typeof obj.limits !== "string") throw new Error("Missing limits");
  if (!obj.next_step || typeof obj.next_step !== "string") throw new Error("Missing next_step");
  validateDecision(obj);
  if (obj.status === "ok" && (!obj.evidence || typeof obj.evidence !== "object")) {
    throw new Error("Missing evidence");
  }
}

export function validateSalaryTrendResponse(data: unknown): asserts data is SalaryTrendResponse {
  if (!data || typeof data !== "object") throw new Error("Invalid response");
  validateSuggestionShape(data as Record<string, unknown>);
}

export function validateTransferMatchesResponse(
  data: unknown
): asserts data is TransferMatchesResponse {
  if (!data || typeof data !== "object") throw new Error("Invalid response");
  validateSuggestionShape(data as Record<string, unknown>);
}

export async function setSuggestionDecision(
  kind: SuggestionKind,
  decision: "acknowledged" | "dismissed"
): Promise<void> {
  const response = await fetch(`/api/bff/suggestions/${kind}/decision`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision }),
  });
  if (!response.ok) {
    throw new Error("Failed to save the suggestion decision");
  }
}

export async function clearSuggestionDecision(kind: SuggestionKind): Promise<void> {
  const response = await fetch(`/api/bff/suggestions/${kind}/decision`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error("Failed to clear the suggestion decision");
  }
}
