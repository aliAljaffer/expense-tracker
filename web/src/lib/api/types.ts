/**
 * Types for import preview API responses and money formatting.
 */

export interface ReconciliationCheck {
  name: string;
  status: "pass" | "fail";
  parsed: string;
  stated: string;
}

export interface Reconciliation {
  ok: boolean;
  checks: ReconciliationCheck[];
  parsed_debit_total: number;
  parsed_credit_total: number;
  parsed_debit_count: number;
  parsed_credit_count: number;
}

export interface DuplicateMatch {
  score: number;
  exact: boolean;
  reason: string;
  matches?: number[];
}

export interface AnomalyMatch {
  score: number;
  reason: string;
}

export interface ImportRow {
  posted_date: string;
  description_raw: string;
  debit: number;
  credit: number;
  balance_after: number;
  kind: string;
  merchant_raw?: string;
  card_last4?: string;
  biller_code?: string;
  biller_account?: string;
  fingerprint: string;
  duplicate?: DuplicateMatch;
  anomaly?: AnomalyMatch;
}

export interface Summary {
  rows: number;
  exact_duplicates: number;
  needs_review: number;
  default_rows: number;
  history_rows: number;
  anomaly_ready: boolean;
}

export interface Header {
  opening_balance?: number;
  closing_balance?: number;
  stated_debit_total?: number;
  stated_credit_total?: number;
  stated_debit_count?: number;
  stated_credit_count?: number;
}

export interface ImportPreview {
  import_id: number;
  status: "pending" | "accepted" | "rejected";
  already_imported: boolean;
  bank: string;
  account_number: string;
  iban?: string;
  parser: string;
  parser_version: string;
  period_start: string;
  period_end: string;
  header: Header;
  reconciliation: Reconciliation;
  rows: ImportRow[] | null;
  summary: Summary;
}

/**
 * Format integer halalas to SAR string with proper locale formatting.
 * Uses exact integer math only, no floating point.
 *
 * @param halalas - Integer amount in halalas (1 SAR = 100 halalas)
 * @returns Formatted string like "25.75"
 */
export function formatSAR(halalas: number): string {
  const riyals = Math.floor(halalas / 100);
  const fils = halalas % 100;
  return `${riyals.toString()}.${fils.toString().padStart(2, "0")}`;
}

/**
 * Format integer halalas to display as money with SAR symbol and thousands separator.
 * Returns string like "25.75 SAR" or "1,234.50 SAR".
 *
 * @param halalas - Integer amount in halalas
 * @returns Formatted string with SAR symbol
 */
export function displaySAR(halalas: number): string {
  const sar = formatSAR(halalas);
  const [riyals, fils] = sar.split(".");
  const formattedRiyals = parseInt(riyals, 10).toLocaleString("en-US");
  return `${formattedRiyals}.${fils} SAR`;
}
