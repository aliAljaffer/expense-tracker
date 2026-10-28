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
  default_selected: boolean;
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
  rows: ImportRow[];
  summary: Summary;
  resumed?: boolean;
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

export interface Account {
  id: number;
  bank: string;
  masked_number: string;
  kind: string;
  currency: string;
  balance: number | null;
  balance_date: string | null;
}

export interface AccountsResponse {
  accounts: Account[];
}

export interface IncomeSplit {
  salary: number;
  transfers_in: number;
  refunds: number;
  other: number;
  total: number;
}

export interface SpendingSplit {
  card_purchase: number;
  online_purchase: number;
  intl_purchase: number;
  bill_payment: number;
  cash_withdrawal: number;
  fee: number;
  total: number;
}

export interface TransfersSplit {
  internal: number;
  external_out: number;
  roundup_sweeps: number;
  total: number;
}

export interface CreditCardCoverage {
  card_payments: number;
  purchases_recorded: number;
  uncovered: number;
  uncovered_share: number;
}

export interface MonthlyOverview {
  month: string;
  income: IncomeSplit;
  spending: SpendingSplit;
  transfers: TransfersSplit;
  card_payments: number;
  uncategorised_spending: number;
  outflow_total: number;
  credit_card_coverage: CreditCardCoverage;
  transaction_count: number;
}

export interface MonthlyResponse {
  months: MonthlyOverview[];
}

export interface Transaction {
  id: number;
  account_id: number;
  posted_date: string;
  posted_time: string;
  description: string;
  debit: number;
  credit: number;
  balance_after: number;
  kind: string;
  counts_as_spending: boolean;
  merchant_id: number | null;
  merchant_name: string | null;
  category_id: number | null;
  category_name: string | null;
  fx_currency: string | null;
  fx_amount: number | null;
}

export interface TransactionsResponse {
  rows: Transaction[];
  total_count: number;
  total_debit: number;
  total_credit: number;
}

export interface Category {
  id: number;
  name: string;
}

export interface CategoriesResponse {
  categories: Category[];
}

export interface SuggestionPeriod {
  from: string;
  to: string;
}

export type SuggestionDecision = "" | "acknowledged" | "dismissed";

export type SuggestionKind =
  | "card-coverage"
  | "recurring"
  | "bnpl"
  | "salary-trend"
  | "transfer-matches";

export interface CardCoverageMonth {
  month: string;
  card_payments: number;
  purchases_recorded: number;
  uncovered: number;
  uncovered_share: number;
  transaction_ids: number[];
}

export interface CardCoverageEvidence {
  months: CardCoverageMonth[];
}

export interface CardCoverageResponse {
  status: "ok" | "insufficient_data";
  period: SuggestionPeriod;
  summary: string;
  evidence: CardCoverageEvidence;
  limits: string;
  next_step: string;
  decision?: SuggestionDecision;
}

export interface RecurringSeries {
  merchant: string;
  merchant_id: number;
  occurrence_count: number;
  distinct_months: number;
  median_amount: number;
  total_amount: number;
  first_date: string;
  last_date: string;
  cadence_days: number | null;
  transaction_ids: number[];
}

export interface RecurringEvidence {
  recurring_series: RecurringSeries[];
}

export interface RecurringResponse {
  status: "ok" | "insufficient_data";
  period: SuggestionPeriod;
  summary: string;
  evidence: RecurringEvidence;
  limits: string;
  next_step: string;
  decision?: SuggestionDecision;
}

export interface BnplMonth {
  month: string;
  bnpl_outflow: number;
  payment_count: number;
  previous_month: number;
  three_month_average: number;
  is_rising: boolean;
  transaction_ids: number[];
}

export interface BnplEvidence {
  months: BnplMonth[];
}

export interface BnplResponse {
  status: "ok" | "insufficient_data";
  period: SuggestionPeriod;
  summary: string;
  evidence: BnplEvidence;
  limits: string;
  next_step: string;
  decision?: SuggestionDecision;
}

export interface SalaryMonth {
  month: string;
  salary_total: number;
  deposit_count: number;
}

export interface SalaryTrendEvidence {
  months: SalaryMonth[];
}

export interface SalaryTrendResponse {
  status: "ok" | "insufficient_data";
  period: SuggestionPeriod;
  summary: string;
  evidence: SalaryTrendEvidence;
  limits: string;
  next_step: string;
  decision?: SuggestionDecision;
}

export interface TransferMatch {
  amount: number;
  debit_date: string;
  debit_account: string;
  debit_transaction_id: number;
  credit_date: string;
  credit_account: string;
  credit_transaction_id: number;
  counts_as_spending: boolean;
}

export interface TransferMatchesEvidence {
  matches: TransferMatch[];
}

export interface TransferMatchesResponse {
  status: "ok" | "insufficient_data";
  period: SuggestionPeriod;
  summary: string;
  evidence: TransferMatchesEvidence;
  limits: string;
  next_step: string;
  decision?: SuggestionDecision;
}
