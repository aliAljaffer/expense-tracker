# Data model

Minimum schema to support the Tier 1 and Tier 2 features.

## account

| Field | Notes |
|---|---|
| `id` | |
| `bank` | |
| `number`, `iban` | |
| `currency` | |
| `kind` | `current`, `savings`, `credit_card` |
| `owner_is_user` | Drives transfer netting |

## statement_import

| Field | Notes |
|---|---|
| `id` | |
| `account_id` | |
| `file_sha256` | Unique. Blocks duplicate files |
| `period_start`, `period_end` | |
| `opening_balance`, `closing_balance` | From the header |
| `stated_debit_total`, `stated_credit_total` | From the header |
| `stated_debit_count`, `stated_credit_count` | From the header |
| `parsed_*` | Same four, computed |
| `reconciled` | Boolean. False blocks the import |

## transaction

| Field | Notes |
|---|---|
| `id` | |
| `account_id`, `import_id` | |
| `posted_date`, `posted_time`, `value_date` | They differ. Keep both dates. `posted_time` is `00:00` when the statement states no time |
| `description_raw` | Never discard |
| `debit`, `credit`, `balance_after` | |
| `kind` | See below |
| `merchant_raw`, `merchant_id` | |
| `category_id` | |
| `counts_as_spending` | False for transfers and sweeps |
| `fx_currency`, `fx_amount`, `fx_rate`, `fx_fee` | Nullable |
| `transfer_pair_id` | Self-reference, for netted transfers |
| `shared_expense_id` | Nullable |

### kind

`card_purchase`, `online_purchase`, `intl_purchase`, `refund`,
`roundup_sweep`, `internal_transfer`, `external_transfer_in`,
`external_transfer_out`, `salary`, `cash_deposit`, `cash_withdrawal`,
`bill_payment`, `card_payment`, `fee`

`counts_as_spending` is true only for the purchase kinds, `bill_payment`,
`cash_withdrawal` and `fee`.

## merchant

| Field | Notes |
|---|---|
| `id` | |
| `canonical_name` | |
| `aliases` | The raw strings that map here |
| `default_category_id` | |
| `biller_code`, `biller_account` | Sadad. More reliable than the name |
| `is_bnpl` | |

## recurring_series

Derived, recomputed on import.

| Field | Notes |
|---|---|
| `merchant_id` | |
| `kind` | `contractual`, `subscription`, `habit` |
| `occurrence_count`, `distinct_months` | |
| `median_amount`, `total_amount` | |
| `first_seen`, `last_seen` | |
| `cadence_days` | Median gap. Null when irregular |
| `is_active` | No occurrence in 2 expected cadences means false |

## shared_expense

| Field | Notes |
|---|---|
| `id` | |
| `transaction_id` | The full payment |
| `user_share_ratio` | |
| `reimbursement_transaction_id` | Nullable until matched |
| `expected_reimbursement` | |
| `status` | `pending`, `received`, `overdue` |

## debt

| Field | Notes |
|---|---|
| `id` | |
| `kind` | `credit_card`, `bnpl`, `loan` |
| `account_id` | Nullable. Often not linked |
| `balance`, `credit_limit` | |
| `apr` | |
| `promo_apr`, `promo_expires_on` | Nullable |
| `promo_is_deferred_interest` | Boolean. Changes the payoff math |

`promo_expires_on` should be required, not nullable, whenever `promo_apr` is
set. A promotional rate without a known end date is the case this model exists
to prevent.
