# Privacy

What the app stores, logs, and sends out of the process. Each claim names the
file that decides it.

## What is stored

All app data is in PostgreSQL. There are no statement files on disk.

| Table | Data |
|---|---|
| `account` | Bank, account number, IBAN, currency, kind (`api/migrations/0001_init.up.sql`) |
| `statement_import` | File SHA-256, parser name and version, period, header figures, reconciliation result, status |
| `transaction` | Posting date and time, raw description, debit, credit, balance after, kind, merchant text and link, category link, FX fields |
| `import_preview` | Parsed rows and header of a pending upload, until commit, cancel, or cleanup (`api/migrations/0002_import_preview.up.sql`) |
| `app_setting` | Reminder email and the last reminder month (`api/migrations/0004_settings.up.sql`) |

The remaining tables hold merchants, categories, suggestions, recurring series,
debts, shared expenses, and owner decisions. `docs/DATA-MODEL.md` lists them.

- The uploaded statement is parsed from memory. The bytes are never written to
  disk, and the database keeps the SHA-256, not the file (`docs/API.md`).
- The account number and IBAN are stored because the import preview returns
  them and duplicate detection keys on bank and number
  (`internal/importer/store.go`). The read endpoints return a masked number and
  never an IBAN (`internal/ledger/store.go`).
- The web session cookie holds the OIDC access and refresh tokens. It is
  encrypted with AES-256-GCM using `SESSION_SECRET` (`web/src/lib/auth/session.ts`).
- Bank credentials are not stored. The app imports exported files only
  (`README.md`, Scope).

## What is logged

The API writes JSON lines to stdout through `slog`. It never logs request
bodies, statement contents, account numbers, or amounts
(`internal/httpapi/server.go`).

What the API does log:

- Import id, row count, and status after a preview.
- Import id, inserted count, and skipped rows after a commit.
- Whether a reminder was sent, and why a send failed.
- Migration failures. The credentials in `DATABASE_URL` are replaced with `***`
  before they are logged (`cmd/api/main.go`).
- `send test reminder failed` when the test endpoint returns 502.

The web app has one explicit log line, `auth callback rejected`, which records
a reason and whether a PKCE cookie was present
(`web/src/app/api/auth/callback/route.ts`). It carries no token or account data.

`SMTP_PASS`, `GROOSZY_EXPLAIN_API_KEY`, and `GROOSZY_CHAT_API_KEY` are never
returned by the API and never logged (`docs/API.md`).

## What leaves the process

The reminder email and the LLM endpoints can carry statement or spending data.
Both are optional.

### Reminder email

When `SMTP_ADDR` is set, the API sends the recipient address, the fixed subject,
and the fixed body to the configured SMTP server (`internal/reminder/reminder.go`).
The body names the two banks and asks for the latest statements. It contains no
transactions, amounts, balances, account numbers, or IBANs.

With `SMTP_ADDR` empty, no email leaves the process. See `docs/REMINDERS.md`.

### LLM explainer

The explainer is off unless a base URL, a model, and an API key are all set
(`internal/explain/explain.go`). When it is on, the API sends only the request
the app builds: `kind`, `account_kind`, `period`, and the allowlisted
aggregates (`total_debit`, `total_credit`, `transaction_count`,
`spending_count`, `largest_debit`, `median_debit`, `history_rows`). A field
outside the allowlist is rejected before any provider call.

The model sees no transaction description, merchant name, account number, or
IBAN. The response is returned to the caller and never stored
(`docs/API.md`).

### Chat

`POST /api/chat` sends the last six months of monthly totals and the three
suggestion summaries, already formatted as amounts. It sends no transaction row,
merchant name, account number, IBAN, balance, or file content. An empty database
answers without a provider call.

With `GROOSZY_CHAT_URL` and `GROOSZY_CHAT_API_KEY` set, the packet goes to the
shared chat service on the homelab instead of the local explainer. The central
service sends the same packet to its model provider and does not keep it in its
own database. The short-lived OpenCode session is deleted after the prompt and
lives on an ephemeral directory. With both unset, the request uses the local
explainer settings. See `docs/CHAT.md`.

### Authentication traffic

The browser is redirected to the OIDC issuer, and the API fetches the issuer
discovery document and signing keys at startup. This carries authentication
data only, never statement rows.

No analytics or telemetry package is in `web/package.json`.

## The repository rule

Real statements stay out of Git.

- `statements/` is the first line of `.gitignore`. Never add the directory.
- `AGENTS.md` requires that real statements live there and stay ignored.
- `README.md` requires that every example in `docs/` is synthetic.
- `scripts/check-leaks.py` scans staged text for the owner name, IBAN, account
  number, and reference numbers read from `statements/` when the directory
  exists. It also refuses a Saudi IBAN that is not an obvious dummy. It prints
  the file, line, and kind, never the matched value.
- The pre-commit hook runs that check. Enable it once per clone:

```bash
git config core.hooksPath scripts/hooks
```

The check reads the files in `statements/` to learn the values to refuse. That
directory is ignored and never committed.
