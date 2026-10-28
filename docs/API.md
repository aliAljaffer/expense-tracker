# API

The Go API runs the parsers, decides whether a statement may be imported, and
stores approved rows. It also serves the read endpoints behind the account and
overview views. The browser never calls it directly: Next.js forwards the
owner's access token.

## Configuration

| Variable | Required | Meaning |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `OIDC_ISSUER` | yes | Keycloak realm issuer, for example `https://kc.example.com/realms/homelab` |
| `OIDC_AUDIENCE` | no | Client ID the token must carry. Default `grooszy` |
| `OIDC_OWNER_SUBJECT` | yes | Keycloak subject of the only allowed user |
| `LISTEN_ADDR` | no | Default `:8080` |
| `MAX_UPLOAD_BYTES` | no | Default 16 MiB |
| `GROOSZY_EXPLAIN_PROVIDER` | no | `openai` or `anthropic`. `openai` is assumed when a base URL is set |
| `GROOSZY_EXPLAIN_BASE_URL` | no | Provider API root. No value is built in |
| `GROOSZY_EXPLAIN_MODEL` | no | Model name the provider expects. No value is built in |
| `GROOSZY_EXPLAIN_API_KEY` | no | Provider key. Never returned by the API and never logged |
| `GROOSZY_EXPLAIN_TIMEOUT` | no | Whole seconds. Default 30 |
| `SMTP_ADDR` | no | SMTP `host:port`. Empty disables the monthly reminder |
| `SMTP_USER` | no | SMTP username. Empty sends without authentication |
| `SMTP_PASS` | no | SMTP password. Never returned by the API and never logged |
| `SMTP_FROM` | no | Envelope sender, a bare address. Required when `SMTP_ADDR` is set |
| `REMINDER_TZ` | no | IANA zone that sets the send hour. Default `UTC` |

The API refuses to start when a required value is missing. There is no
authentication bypass.

## Authentication

Every `/api/*` route requires `Authorization: Bearer <access token>`. The token
must be signed by the issuer, carry the audience, and be unexpired. A valid
token for any other subject returns 403.

`/healthz` is public and touches nothing. `/readyz` is public and checks the
database; it returns 503 when the database is unavailable.

## Import flow

1. `POST /api/imports` with multipart field `file`.
2. The API hashes the bytes, picks the parser from the file signature, parses,
   and reconciles against the six header figures.
3. A rejected statement is stored with status `rejected` and returned with
   status 422. It can never be committed.
4. A reconciled statement is stored with status `pending` and returned with the
   header figures, reconciliation checks, every parsed row, and the duplicate
   and anomaly scores.
5. `POST /api/imports/{id}/commit` stores the approved rows and accepts the
   import in one database transaction.
6. `DELETE /api/imports/{id}` cancels a pending review.

The uploaded file is parsed from memory and never written to disk. The database
keeps the file SHA-256, parser version, period, header figures, reconciliation
result, and import status.

A file whose SHA-256 is already stored returns the earlier result. For a pending
import with a loadable preview, `resumed: true` indicates an earlier upload
awaiting review that can now be committed. For an accepted (committed) import,
`already_imported: true` indicates the file was already imported and cannot be
committed again.

## Responses

`POST /api/imports` returns a preview:

```json
{
  "import_id": 12,
  "status": "pending",
  "already_imported": false,
  "resumed": false,
  "bank": "alinma",
  "account_number": "00000000000000",
  "parser": "alinma",
  "parser_version": "1",
  "period_start": "2026-01-01",
  "period_end": "2026-03-31",
  "header": {
    "opening_balance": 100000,
    "closing_balance": 118600,
    "stated_debit_total": 62400,
    "stated_credit_total": 81000,
    "stated_debit_count": 12,
    "stated_credit_count": 3
  },
  "reconciliation": {
    "ok": true,
    "checks": [
      {"name": "debit_total", "status": "pass", "parsed": "624.00", "stated": "624.00"}
    ],
    "parsed_debit_total": 62400,
    "parsed_credit_total": 81000,
    "parsed_debit_count": 12,
    "parsed_credit_count": 3
  },
  "rows": [
    {
      "posted_date": "2026-01-05",
      "description_raw": "card purchase",
      "debit": 2575,
      "credit": 0,
      "kind": "card_purchase",
      "fingerprint": "00000000000000000000000000000000",
      "duplicate": {"score": 9, "exact": false, "reason": "same amount on the same day, same merchant"},
      "default_selected": false
    }
  ],
  "summary": {
    "rows": 1,
    "exact_duplicates": 0,
    "needs_review": 1,
    "default_rows": 0,
    "history_rows": 340,
    "anomaly_ready": true
  }
}
```

All money is integer halalas.

`already_imported` is true only when the file SHA-256 matches an accepted (committed)
import. `resumed` is true when the file SHA-256 matches a pending import with a
loadable preview, allowing the owner to review and commit an earlier upload.

`default_selected` indicates whether the row is included in the default selection
when the owner commits without providing explicit row choices. Rows with exact
duplicate fingerprints or held for review (duplicate or anomaly score 8 or higher)
are not default selected.

A row whose merchant has a stored alias also carries `merchant_display`, the
name to show instead of `merchant_raw`. The alias is display only and never
enters the fingerprint.

Commit accepts an optional row selection:

```json
{"rows": [0, 2, 3]}
```

Omit `rows` to store the default selection. The default excludes exact
duplicates and rows held for review. Commit returns:

```json
{"import_id": 12, "inserted": 3, "skipped": [{"row_id": 1, "reason": "already_imported"}]}
```

`skipped` is a list of rows that were not inserted. `row_id` is the zero-based
index of the row in the selection. `reason` is why the row was skipped.
Currently the only reason is `already_imported` for exact fingerprint matches.

## Read endpoints

All read routes require the bearer token. They return 503
`{"error":"database unavailable"}` when the database is not reachable.

### GET /api/accounts

Returns every account. `masked_number` keeps only the last four characters of
the account number, and no IBAN is returned. `balance` is the `balance_after`
of the newest transaction by posting date, time and id, null when the account
has no transactions. `balance_date` is that transaction's posting date.

```json
{
  "accounts": [
    {
      "id": 1,
      "bank": "alinma",
      "masked_number": "**********6060",
      "kind": "current",
      "currency": "SAR",
      "balance": 118600,
      "balance_date": "2026-03-31"
    }
  ]
}
```

### GET /api/overview/monthly

| Parameter | Required | Meaning |
|---|---|---|
| `from` | no | First month, `YYYY-MM`. Default: 11 months before the current month |
| `to` | no | Last month, `YYYY-MM`. Default: the current month |

Set both or neither. `from` after `to` returns 400. Months without a
transaction are omitted; entries are oldest first. Every amount is integer
halalas. Only `uncovered_share` is a ratio.

- `income.total` is every credit in the month. `salary`, `transfers_in` and
  `refunds` split out those kinds; `other` holds the rest (`cash_deposit` and
  any other credit).
- `spending` uses the generated `counts_as_spending` column with `debit > 0`.
  Internal transfers, external transfers out, round-up sweeps and card payments
  never enter it.
- `transfers` is reported separately and never added to spending.
- `uncategorised_spending` is the part of `spending.total` whose category is
  null.
- `outflow_total` is every debit in the month, all kinds.
- `credit_card_coverage.uncovered` is `greatest(card_payments -
  purchases_recorded, 0)`, where `purchases_recorded` is the debit of the three
  purchase kinds. `uncovered_share` is `uncovered / card_payments` to six
  decimal places, 0 when there are no card payments.

```json
{
  "months": [
    {
      "month": "2026-02",
      "income": {"salary": 100000, "transfers_in": 5000, "refunds": 2500, "other": 1200, "total": 108700},
      "spending": {"card_purchase": 2575, "online_purchase": 990, "intl_purchase": 2667, "bill_payment": 15000, "cash_withdrawal": 50000, "fee": 1250, "total": 72482},
      "transfers": {"internal": 20000, "external_out": 3000, "roundup_sweeps": 250, "total": 23250},
      "card_payments": 58000,
      "uncategorised_spending": 1250,
      "outflow_total": 143732,
      "credit_card_coverage": {
        "card_payments": 58000,
        "purchases_recorded": 6232,
        "uncovered": 51768,
        "uncovered_share": 0.892552
      },
      "transaction_count": 14
    }
  ]
}
```

### GET /api/transactions

| Parameter | Required | Meaning |
|---|---|---|
| `from` | no | First posting date, `YYYY-MM-DD`, inclusive |
| `to` | no | Last posting date, `YYYY-MM-DD`, inclusive |
| `account_id` | no | Only this account |
| `merchant_id` | no | Only this merchant (positive integer); combined with other filters by AND |
| `bucket` | no | One of the buckets below. Default `all` |
| `kind` | no | One transaction kind |
| `limit` | no | Page size, default 100, maximum 500 |
| `offset` | no | Rows to skip, default 0 |

A bucket selects exactly the rows that add up to one monthly total:

| Bucket | Monthly total it explains |
|---|---|
| `all` | No bucket filter |
| `income` | `income.total` |
| `spending` | `spending.total` |
| `transfers` | `transfers.total` |
| `card_payments` | `card_payments` and `credit_card_coverage.card_payments` |
| `uncategorised` | `uncategorised_spending` |
| `refunds` | `income.refunds` |

`total_count`, `total_debit` and `total_credit` cover the whole filtered set,
not the page. Rows are newest first.

```json
{
  "rows": [
    {
      "id": 34,
      "account_id": 1,
      "posted_date": "2026-03-05",
      "posted_time": "10:15:00",
      "description": "card purchase sample market",
      "debit": 2575,
      "credit": 0,
      "balance_after": 118600,
      "kind": "card_purchase",
      "counts_as_spending": true,
      "merchant_id": 9,
      "merchant_name": "Sample Market",
      "category_id": 3,
      "category_name": "Groceries",
      "fx_currency": null,
      "fx_amount": null
    }
  ],
  "total_count": 7,
  "total_debit": 72482,
  "total_credit": 0
}
```

## Category and merchant edits

These routes change stored rows. They require the bearer token and return 503
`{"error":"database unavailable"}` when the database is not reachable.

### GET /api/categories

Lists every category by name:

```json
{"categories": [{"id": 1, "name": "Housing"}]}
```

### PATCH /api/transactions/{id}

```json
{"category_id": 3, "apply_to_merchant": false}
```

`category_id` is required. A positive integer sets that row's category, `null`
clears it. When `apply_to_merchant` is true and the row has a merchant, every
row of that merchant gets the same category. One statement does both. Returns
204.

| Status | Meaning |
|---|---|
| 404 | No transaction with that id |
| 422 | Body is not the shape above, `category_id` is missing, or the category does not exist |

### PUT /api/merchants/{id}

```json
{"alias": "Rent Agency"}
```

Stores the display name for a merchant. `null` clears it, so the canonical name
returns. The alias is trimmed and must be 1 to 120 characters. It is display
only: an alias never changes a fingerprint, a stored `merchant_raw`, or the
canonical name. The transaction list and later import previews show the alias.
Returns 204.

| Status | Meaning |
|---|---|
| 404 | No merchant with that id |
| 422 | Body is not the shape above, `alias` is missing, not a string, blank, or longer than 120 characters |

## Duplicate scores

An exact fingerprint match is reported as already imported and never inserted
again. Other matches score 1 to 10:

| Score | Meaning |
|---|---|
| 4 to 7 | Same amount within three days, with merchant or description similarity |
| 8 to 10 | Held for owner review |

The score is a review aid. Repeated purchases at the same merchant are common;
the owner decides.

## Anomaly scores

Rows score 1 to 10 for a first payment to a merchant and for an amount far
above the median purchase. Scores of 8 to 10 are held for review. The score is
not a fraud signal.

`anomaly_ready` is false until the account has 20 spending rows. The app must
show that the comparison is not available yet.

## Explainers

Optional prose explanations of figures the app already computed. The feature is
off unless a base URL, a model, and an API key are all set. It never changes
money, imports, scores, or stored records. See `docs/EXPLAINERS.md`.

`GET /api/explainers/status`:

```json
{"enabled": true, "provider": "openai", "model": "synthetic-model"}
```

The status never carries the key or the base URL. A disabled explainer returns:

```json
{"enabled": false, "provider": "", "model": ""}
```

`POST /api/explanations`:

```json
{
  "kind": "duplicate",
  "account_kind": "credit_card",
  "period": {"start": "2026-03-01", "end": "2026-03-31"},
  "aggregates": {
    "total_debit": 62400,
    "transaction_count": 12,
    "median_debit": 2575
  }
}
```

`kind` is one of `duplicate`, `anomaly`, `recurring`, `fees`, `cash_flow`.
`account_kind` is one of `current`, `savings`, `credit_card`, or omitted.
Aggregates allow only `total_debit`, `total_credit`, `transaction_count`,
`spending_count`, `largest_debit`, `median_debit`, and `history_rows`. Money is
integer halalas.

The response is text only:

```json
{
  "text": "Twelve withdrawals left the card this month, and the median purchase was 25.75 riyals.",
  "model": "synthetic-model",
  "provider": "openai"
}
```

| Status | Meaning |
|---|---|
| 400 | Body carries a field outside the allowlist, or a value of the wrong type. The error names the field |
| 409 | The explainer is disabled |
| 413 | Body exceeds 64 KiB |
| 502 | The provider call failed |

The text is returned to the caller and never written to the database.

### POST /api/chat

An owner-only conversation with Gersz about the last six months. The handler
reads monthly totals and the three suggestion summaries from the ledger on each
request and sends them with the conversation as one provider call. Nothing is
streamed and no conversation is stored.

```json
{
  "messages": [
    {"role": "user", "content": "How much did I spend in May?"},
    {"role": "assistant", "content": "You spent 3,500.00 SAR in May."},
    {"role": "user", "content": "Where can I cut back?"}
  ]
}
```

- 1 to 8 messages. The last message must be `user`.
- Each `content` is at most 2000 characters and may not be blank.
- `role` is `user` or `assistant`. Any other role, including `system`, returns
  422.
- 64 KiB body limit. One provider call per request, bounded by
  `GROOSZY_EXPLAIN_TIMEOUT` and the configured maximum output tokens.

Success returns:

```json
{"reply": "You spent 3,500.00 SAR in May. Card payments cover the largest share, so importing the card statement would sharpen the picture."}
```

| Status | Meaning |
|---|---|
| 422 | Bad shape: empty conversation, more than 8 messages, blank content, content over 2000 characters, an unsupported role, or a last message from the assistant |
| 503 | `{"error":"chat is not configured"}` when the base URL, model, or key is missing; `{"error":"database unavailable"}` when the ledger is not reachable |
| 502 | `{"error":"the model did not answer"}` when the provider fails or returns no text |

The model sees monthly income, spending, card payments, uncategorised spending,
transaction counts, and the three suggestion summaries. It never sees a
transaction description, merchant name, account number, IBAN, per-account
balance, or file content. The recurring summary is rebuilt without the merchant
name for this reason. With no transactions stored, the endpoint answers with a
fixed sentence and calls no provider. See `docs/CHAT.md`.

## Suggestion endpoints

All suggestion endpoints are read-only, deterministic, and return insufficient_data
rather than estimating when data is too thin. They accept optional `from` and `to`
parameters in `YYYY-MM` format, defaulting to the last 12 months. Set both or
neither. Months without a transaction are omitted from results. All money is
integer halalas.

Common response shape:

```json
{
  "status": "ok|insufficient_data",
  "period": {"from": "YYYY-MM", "to": "YYYY-MM"},
  "summary": "one short plain sentence",
  "evidence": { "varies_by_endpoint": "..." },
  "limits": "what this suggestion does not cover",
  "next_step": "one recommended action",
  "decision": ""
}
```

`decision` is `""`, `"acknowledged"`, or `"dismissed"`. A dismissed suggestion
still returns its data; the interface hides it behind a dismissed state.

### GET /api/suggestions/card-coverage

Detects card payments without recorded purchase statements. Per uncovered month:
card payment total, recorded purchases, uncovered amount, uncovered share (ratio),
and the transaction ids of the card payment rows.

```json
{
  "status": "ok",
  "period": {"from": "2026-02", "to": "2026-12"},
  "summary": "Seven of twelve months had card payments without matching purchase statements.",
  "evidence": {
    "months": [
      {
        "month": "2026-02",
        "card_payments": 58000,
        "purchases_recorded": 6232,
        "uncovered": 51768,
        "uncovered_share": 0.892552,
        "transaction_ids": [123, 456]
      }
    ]
  },
  "limits": "Does not account for manually entered card statements or categories.",
  "next_step": "Import the card statement for Feb 2026."
}
```

Insufficient_data when fewer than one month has card payments.

### GET /api/suggestions/recurring

Detects recurring payments appearing in at least 3 distinct months with at least
3 occurrences, stable amounts within 20% of median, and consistent cadence
(no gap between occurrences exceeds 45 days). Per series: merchant name and id,
occurrence count, distinct months, median and total amount, first and last date,
median cadence in days, and transaction ids.

```json
{
  "status": "ok",
  "period": {"from": "2026-02", "to": "2026-12"},
  "summary": "Nine recurring payments found. The largest is rent (3,500.00 SAR/month).",
  "evidence": {
    "recurring_series": [
      {
        "merchant": "Rent Agency",
        "merchant_id": 1,
        "occurrence_count": 12,
        "distinct_months": 12,
        "median_amount": 350000,
        "total_amount": 4200000,
        "first_date": "2026-02-01",
        "last_date": "2026-12-01",
        "cadence_days": 30,
        "transaction_ids": [100, 101, ...]
      }
    ]
  },
  "limits": "Recurring series must appear in at least 3 distinct months with stable amounts and consistent cadence. May not detect recently started payments.",
  "next_step": "Review and categorize the recurring payments."
}
```

Insufficient_data when no merchants meet the threshold.

### GET /api/suggestions/bnpl

Detects buy-now-pay-later commitments and trends. BNPL identification uses
known provider names (Tabby, Tamara, Postpay, Spotii, Cashew) matched on
normalized merchant name, plus manual merchant tagging. Per month: outflow total,
payment count, previous month outflow, 3-month average, and transaction ids.
Months are flagged as rising when outflow exceeds both the previous month and
the 3-month average.

```json
{
  "status": "ok",
  "period": {"from": "2026-01", "to": "2026-12"},
  "summary": "BNPL commitments are rising: 4,500.00 SAR this month vs 3,500.00 SAR average.",
  "evidence": {
    "months": [
      {
        "month": "2026-04",
        "bnpl_outflow": 4500,
        "payment_count": 3,
        "previous_month": 4000,
        "three_month_average": 3500,
        "is_rising": true,
        "transaction_ids": [200, 201, 202]
      }
    ]
  },
  "limits": "BNPL identification uses known provider names (Tabby, Tamara, Postpay, Spotii, Cashew) and manual merchant tagging. Unknown providers will not be detected.",
  "next_step": "Review upcoming BNPL payment dates and plan repayment."
}
```

Insufficient_data when no merchants are marked as BNPL or fewer than 3 months
of BNPL transactions exist. Returns ok with all months (rising and flat/falling)
when 3+ months of data exist.

### GET /api/suggestions/salary-trend

Groups salary income by month. Per month: salary total and the count of salary
deposits. Summary compares the first and last month with a salary row and calls
income steady (under 5% change), rising, or falling, with the change percentage.

```json
{
  "status": "ok",
  "period": {"from": "2026-01", "to": "2026-03"},
  "summary": "Salary income is rising 20% from 3,500.00 SAR to 4,200.00 SAR across 3 months.",
  "evidence": {
    "months": [
      {"month": "2026-01", "salary_total": 350000, "deposit_count": 1},
      {"month": "2026-02", "salary_total": 350000, "deposit_count": 1},
      {"month": "2026-03", "salary_total": 420000, "deposit_count": 1}
    ]
  },
  "limits": "Salary detection relies on the statement row being recorded as salary. Months without a salary row are omitted.",
  "next_step": "Compare the salary trend with the spending trend before changing a budget.",
  "decision": ""
}
```

Insufficient_data when fewer than 3 months have a salary row.

### GET /api/suggestions/transfer-matches

Finds likely internal transfers: one debit and one credit of the same amount in
different accounts, at most 3 days apart, with neither row already matched.
Accounts are masked to the last four characters. The endpoint only reads; it
never writes a pairing to the transaction table.

```json
{
  "status": "ok",
  "period": {"from": "2026-02", "to": "2026-03"},
  "summary": "2 likely internal transfers found. They are not counted as spending, so the spending figure is not inflated.",
  "evidence": {
    "matches": [
      {
        "amount": 50000,
        "debit_date": "2026-02-10",
        "debit_account": "Alinma **********0040",
        "debit_transaction_id": 26,
        "credit_date": "2026-02-11",
        "credit_account": "Al Rajhi **********0041",
        "credit_transaction_id": 40,
        "counts_as_spending": false
      }
    ]
  },
  "limits": "Matching uses amount, account and a 3 day window. It cannot tell a transfer from two unrelated payments of the same amount.",
  "next_step": "Review each pair and mark it as an internal transfer so it leaves the spending figure.",
  "decision": ""
}
```

Insufficient_data when no pair matches. The summary states whether any matched
debit currently counts as spending and, if so, by how much it inflates the
spending figure.

### POST /api/suggestions/{kind}/decision

Stores the owner decision for one suggestion in `user_decision`. `kind` is one
of `card-coverage`, `recurring`, `bnpl`, `salary-trend`, or `transfer-matches`.

```json
{"decision": "dismissed"}
```

`decision` is `dismissed` or `acknowledged`. Unknown kinds and unknown decisions
return 422. Success returns 200 with `{"decision": "dismissed"}`.

### DELETE /api/suggestions/{kind}/decision

Clears the stored decision for that suggestion and returns 204. An unknown kind
returns 422. Both decision routes return 503 when the database is not reachable.

## Settings and the monthly reminder

The API emails the owner on the first of every month, at 08:00 in `REMINDER_TZ`,
asking for the latest statements. The send happens once per month, and
`reminder_last_sent` is recorded only after a successful send. Leaving
`SMTP_ADDR` empty disables reminders: the API logs one line at startup and never
sends.

See `docs/REMINDERS.md` for the full schedule, SMTP setup, and the settings
screen.

All settings routes require the bearer token and return 503
`{"error":"database unavailable"}` when the database is not reachable.

### GET /api/settings

```json
{"reminder_email": "owner@example.com"}
```

`reminder_email` is an empty string when the owner has not set an address.

### PUT /api/settings

Body:

```json
{"reminder_email": "owner@example.com"}
```

The address is validated with `net/mail.ParseAddress`. An empty or invalid
address returns 422 with `{"error":"..."}` and stores nothing. On success the
stored address is returned in the same shape as `GET /api/settings`.

### POST /api/settings/reminder/test

Sends the reminder now to the stored address, so delivery can be checked
without waiting for the first of the month.

- 200 `{"sent": true}` when the email was accepted by the SMTP server.
- 422 `{"error": "no reminder email set"}` when no address is stored.
- 502 `{"error": "..."}` when sending fails or email is disabled.

## Known limits

- An Al Rajhi PDF is capped at 120 pages. A longer file is rejected as
  unreadable before any page text is read.
- The parsers do not expose a posting time, so fingerprints use midnight. The
  running balance still separates sequential rows.
- Merchant normalization and category rules arrive with the overview phase.

## Local development

```
docker run -d --name expense-db -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test -p 5432:5432 postgres:17
export DATABASE_URL='postgres://postgres:test@localhost:5432/test?sslmode=disable'
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f api/migrations/0001_init.up.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f api/migrations/0002_import_preview.up.sql
```

Integration tests create and drop their own schema. Without `DATABASE_URL` they
skip.

```
go test ./...
DATABASE_URL=... go test -race ./...
```
