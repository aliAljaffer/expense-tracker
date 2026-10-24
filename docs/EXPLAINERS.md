# Explainers

An explainer turns figures the app already computed into two or three sentences
of prose with a large language model. It is optional, read-only, and off by
default.

The model cannot change a balance, an import decision, a duplicate score, an
anomaly score, or a stored record. It writes text and nothing else. The text is
never written to the database.

## Opt-in warning

Enabling an explainer sends aggregate figures to the provider you configure. If
the provider is a hosted service, those figures leave your machine. Nothing else
leaves it.

Set the feature only when you accept that trade. Unset any one of the base URL,
model, or key to switch it off again.

## What is sent

The request body is screened against a fixed allowlist. Only these fields reach
the model:

| Field | Meaning |
|---|---|
| `kind` | Suggestion kind: `duplicate`, `anomaly`, `recurring`, `fees`, or `cash_flow` |
| `account_kind` | `current`, `savings`, `credit_card`, or omitted |
| `period.start`, `period.end` | Statement period, ISO dates |
| `aggregates.total_debit` | Total debits in halalas |
| `aggregates.total_credit` | Total credits in halalas |
| `aggregates.transaction_count` | Row count |
| `aggregates.spending_count` | Rows that count as spending |
| `aggregates.largest_debit` | Largest single debit in halalas |
| `aggregates.median_debit` | Median debit in halalas |
| `aggregates.history_rows` | Stored rows available for comparison |

A body with any other field is rejected with 400, and the error names the
offending field. The provider receives the same allowlisted JSON, plus a fixed
system instruction that forbids calculating, financial advice, and invented
figures, and that requires the model to say its figures come from the app.

## What is never sent

- Raw or normalized transaction descriptions
- Merchant names
- Account numbers, IBANs, or card digits
- File contents, file names, or file hashes
- Opening or closing balances
- Names, emails, subjects, or any other identity data

The API key is sent only in the provider's auth header. It is never returned by
`/api/explainers/status`, never logged, and never written to a response. Logs
carry only success or failure and a duration.

## Settings

| Variable | Meaning |
|---|---|
| `EXPENSE_EXPLAIN_PROVIDER` | `openai` (default when a base URL is set) or `anthropic` |
| `EXPENSE_EXPLAIN_BASE_URL` | API root of the provider |
| `EXPENSE_EXPLAIN_MODEL` | Model name the provider expects |
| `EXPENSE_EXPLAIN_API_KEY` | Key for the provider. A local server may accept any placeholder value |
| `EXPENSE_EXPLAIN_TIMEOUT` | Whole seconds, default 30 |

There is no built-in endpoint, model, or key. All three of base URL, model, and
key must be non-empty before the feature turns on.

## Enable a local model

Any local server that speaks the OpenAI chat completions format works. The base
URL is the root that sits before `/chat/completions`. For Ollama, which serves
that path under `/v1`:

```
export EXPENSE_EXPLAIN_PROVIDER="openai"
export EXPENSE_EXPLAIN_BASE_URL="http://127.0.0.1:11434/v1"
export EXPENSE_EXPLAIN_MODEL="<the model you pulled>"
export EXPENSE_EXPLAIN_API_KEY="local"
```

A local server keeps every figure on your machine. It still needs a model name
it recognises, and a key value it accepts.

## Enable a hosted provider

An OpenAI-compatible host, for example OpenRouter, OpenAI, z.ai, Moonshot, or
any compatible gateway, uses the `openai` provider and the base URL printed in
that provider's documentation:

```
export EXPENSE_EXPLAIN_PROVIDER="openai"
export EXPENSE_EXPLAIN_BASE_URL="<provider API root>"
export EXPENSE_EXPLAIN_MODEL="<provider model name>"
export EXPENSE_EXPLAIN_API_KEY="<provider key>"
```

The Anthropic messages endpoint uses the `anthropic` provider and the provider
root as the base URL. The app appends `/v1/messages` itself:

```
export EXPENSE_EXPLAIN_PROVIDER="anthropic"
export EXPENSE_EXPLAIN_BASE_URL="https://api.anthropic.com"
export EXPENSE_EXPLAIN_MODEL="<provider model name>"
export EXPENSE_EXPLAIN_API_KEY="<provider key>"
```

## Check it

```
curl -s -H "Authorization: Bearer <token>" http://localhost:8080/api/explainers/status
```

`{"enabled":true,"provider":"openai","model":"..."}` means the feature is live.
`{"enabled":false,"provider":"","model":""}` means one of the three required
values is missing.
