# Chat

`POST /api/chat` lets the owner ask Gersz about their money in plain language.
The model answers from aggregates the app already computed and never from
statement rows. The endpoint is optional, read-only, and off unless a backend is
configured.

The model cannot change a balance, an import, a score, or a stored record. It
writes text and nothing else.

## Local or central

The endpoint has two backends:

- **Central service.** Set `GROOSZY_CHAT_URL` to the shared chat API and
  `GROOSZY_CHAT_API_KEY` to the key created for grooszy on that service. The
  handler keeps its packet and sends it as the `context` field. The central
  service owns the system prompt, so the profile for grooszy must carry the Gersz
  instruction from `kubernetes/apps/chat/README.md`.
- **Local explainer.** With both central variables unset, the handler calls the
  provider configured by `GROOSZY_EXPLAIN_*` directly.

The central service is preferred when both variables are set. The local
explainers still use `GROOSZY_EXPLAIN_*` for prose, so both can run together.

`GROOSZY_CHAT_TIMEOUT` sets the whole seconds for the central call. The default is
60.

## Contract

Owner-only. Every `/api/*` route uses the same bearer token check.

Request:

```json
{
  "messages": [
    {"role": "user", "content": "How much did I spend in May?"},
    {"role": "assistant", "content": "You spent 3,500.00 SAR in May."},
    {"role": "user", "content": "Where can I cut back?"}
  ]
}
```

| Rule | Value |
|---|---|
| Messages | 1 to 8 |
| Roles | `user` or `assistant`. A `system` role is refused |
| Last message | Must be `user` |
| Content length | 1 to 2000 characters, not blank |
| Body size | 64 KiB |
| Provider calls | One per request |

The handler owns the system prompt. A client cannot send or override it.

Response 200:

```json
{"reply": "You spent 3,500.00 SAR in May."}
```

Failures:

| Status | Body | Cause |
|---|---|---|
| 422 | `{"error": "..."}` | The message shape breaks any rule above |
| 503 | `{"error":"chat is not configured"}` | Neither backend is configured: the central URL and key are unset and `GROOSZY_EXPLAIN_BASE_URL`, `GROOSZY_EXPLAIN_MODEL`, or `GROOSZY_EXPLAIN_API_KEY` is empty |
| 503 | `{"error":"database unavailable"}` | The ledger is not reachable |
| 502 | `{"error":"the model did not answer"}` | The provider failed or returned no text |

The local call uses `GROOSZY_EXPLAIN_TIMEOUT` and the configured maximum output
tokens. The central call uses `GROOSZY_CHAT_TIMEOUT` and the central service's
limits. Consecutive turns are sent as one call either way, so the conversation is
never replayed request by request.

## The context packet

Built on the server for each request. It holds:

- The last six months from the same query the overview uses: month, income
  total, spending total, card payments, uncategorised spending, transaction
  count.
- The summaries of the three suggestions: card coverage, recurring payments,
  BNPL.

Amounts are formatted before they reach the model, for example `3,500.00 SAR`,
so the model copies a figure instead of doing arithmetic.

## Privacy boundary

Never in the packet, never in the prompt:

- Account numbers, IBANs, or card digits
- Per-account balances
- Transaction descriptions or merchant names
- File contents, file names, or file hashes
- Names, emails, subjects, or other identity data

The recurring suggestion summary names the merchant that dominates it, so the
chat packet rebuilds that summary from the count and the median amount. The test
suite builds a packet from a fixture that carries an account number and a
transaction description and asserts that neither appears.

With no transactions stored, the endpoint returns
`{"reply":"I have no spending data yet. Import a statement and ask me again."}`
and calls no provider.

## System prompt

The fixed instruction names Gersz, limits answers to the packet, requires a
plain statement when the data cannot answer, asks for short and concrete advice,
forbids inventing, estimating, or calculating a figure, requires the
`3,500.00 SAR` money style, and forbids em dashes.

## Example

```bash
curl -s -X POST http://localhost:8080/api/chat \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"How did my spending change over the last six months?"}]}'
```

```json
{"reply":"Spending rose from 3,100.00 SAR to 3,500.00 SAR over the six months. Card payments are the largest single outflow, so importing your card statements would make the picture complete."}
```

## Settings

In central mode the chat uses `GROOSZY_CHAT_URL`, `GROOSZY_CHAT_API_KEY`, and
`GROOSZY_CHAT_TIMEOUT`. In local mode it uses the explainer settings and adds
none. See `docs/EXPLAINERS.md` for the explainer variables and how to point them
at a local model.

The central service does not keep a `/v1/chat` request or reply in its own
database. It creates a short-lived OpenCode session, prompts it once, and deletes
it. OpenCode keeps that session on an ephemeral directory, not on the persistent
volume. The app profile and the UI conversations live in the service's SQLite
database.

The key is sent only in the provider or central service auth header. It is never
returned by the API and never logged. Logs carry only success or failure and a
duration, never a prompt, a reply, or an amount.
