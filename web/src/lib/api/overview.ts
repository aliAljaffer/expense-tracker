import {
  AccountsResponse,
  MonthlyResponse,
  SpendingByTimeResponse,
  TransactionsResponse,
} from "./types";

export async function getAccounts(): Promise<AccountsResponse> {
  const response = await fetch("/api/bff/accounts");

  if (!response.ok) {
    throw new Error("Failed to fetch accounts");
  }

  return response.json();
}

export interface GetMonthlyParams {
  from?: string;
  to?: string;
}

export async function getMonthlyOverview(
  params?: GetMonthlyParams
): Promise<MonthlyResponse> {
  const url = new URL("/api/bff/overview/monthly", window.location.origin);

  if (params?.from) url.searchParams.set("from", params.from);
  if (params?.to) url.searchParams.set("to", params.to);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error("Failed to fetch monthly overview");
  }

  return response.json();
}

export async function getSpendingByTime(
  params?: GetMonthlyParams
): Promise<SpendingByTimeResponse> {
  const url = new URL("/api/bff/overview/time", window.location.origin);

  if (params?.from) url.searchParams.set("from", params.from);
  if (params?.to) url.searchParams.set("to", params.to);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error("Failed to fetch spending by time");
  }

  return response.json();
}

export interface GetTransactionsParams {
  from?: string;
  to?: string;
  bucket?: string;
  kind?: string;
  account_id?: number;
  merchant_id?: number;
  limit?: number;
  offset?: number;
}

export async function getTransactions(
  params?: GetTransactionsParams
): Promise<TransactionsResponse> {
  const url = new URL("/api/bff/transactions", window.location.origin);

  if (params?.from) url.searchParams.set("from", params.from);
  if (params?.to) url.searchParams.set("to", params.to);
  if (params?.bucket) url.searchParams.set("bucket", params.bucket);
  if (params?.kind) url.searchParams.set("kind", params.kind);
  if (params?.account_id) url.searchParams.set("account_id", params.account_id.toString());
  if (params?.merchant_id) url.searchParams.set("merchant_id", params.merchant_id.toString());
  if (params?.limit) url.searchParams.set("limit", params.limit.toString());
  if (params?.offset) url.searchParams.set("offset", params.offset.toString());

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error("Failed to fetch transactions");
  }

  return response.json();
}
