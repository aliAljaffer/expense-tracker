# Grooszy Installation Guide

Install Grooszy, configure its integrations, and review its features. The
[README](../README.md) has the short local setup instructions.

## Features

| Area | Details |
|---|---|
| CLI | Parse one Alinma XLSX or Al Rajhi PDF export, report reconciliation, and optionally write JSON. |
| Import | Parse uploads in memory. Check all six statement header figures. Reject files that do not reconcile. Detect exact duplicates by content hash. Resume pending imports. |
| Review | Score rows for duplicates and anomalies. Select rows to commit in one database transaction. |
| Overview | Show balances, monthly income and outflow, spending by category and time of day, and a summary for the latest month. |
| Transactions | Filter by month, kind, account, or merchant. Paginate results. Edit categories and merchant aliases. |
| Suggestions | Detect recurring payments, card coverage, BNPL plans, salary trends, and transfer matches. Keep acknowledged and dismissed decisions. |
| AI | Ask Gersz about spending figures. Requests use aggregates, not transaction rows, merchant names, account numbers, or balances. |
| Reminder | Send a monthly email asking you to upload current statements. |
| Access control | Use Keycloak OIDC and allow one configured subject. Next.js forwards the browser token to the API. |
| Metrics | Expose HTTP and business metrics for Prometheus on a separate listener. The listener has no authentication. |

## Requirements

- Go 1.26
- Node 22
- PostgreSQL 17
- Docker for a local database
- An OIDC issuer such as Keycloak

The API requires `DATABASE_URL`, `OIDC_ISSUER`, and `OIDC_OWNER_SUBJECT`. The
web app requires `OIDC_CLIENT_ID`, `SESSION_SECRET`, `APP_ORIGIN`, and
`API_BASE_URL` in addition to `OIDC_ISSUER`.

## Local setup

Start PostgreSQL and set the database URL:

```bash
docker run -d --name expense-db \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=test \
  -p 5432:5432 postgres:17

export DATABASE_URL='postgres://postgres:test@localhost:5432/test?sslmode=disable'
```

Start the API with an OIDC issuer and the subject allowed to sign in:

```bash
export OIDC_ISSUER=https://kc.example.com/realms/homelab
export OIDC_AUDIENCE=grooszy
export OIDC_OWNER_SUBJECT=<allowed-keycloak-subject>
go run ./cmd/api
```

The API applies database migrations at startup and listens on `:8080` by
default.

Start the web app:

```bash
cd web
npm ci
OIDC_ISSUER=https://kc.example.com/realms/homelab \
OIDC_CLIENT_ID=grooszy \
SESSION_SECRET=at-least-32-characters-of-local-secret \
APP_ORIGIN=http://127.0.0.1:3000 \
API_BASE_URL=http://127.0.0.1:8080 \
npm run dev
```

For a local test issuer or Kubernetes, see the [operations guide](OPERATIONS.md).

## Configuration

The API stops at startup if a required setting is missing. It has no
authentication bypass.

| Group | Settings |
|---|---|
| Database and access | `DATABASE_URL`, `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_OWNER_SUBJECT`, `LISTEN_ADDR`, `MAX_UPLOAD_BYTES` |
| Web session | `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` (optional), `SESSION_SECRET`, `APP_ORIGIN`, `API_BASE_URL` |
| AI explainers | `GROOSZY_EXPLAIN_PROVIDER`, `GROOSZY_EXPLAIN_BASE_URL`, `GROOSZY_EXPLAIN_MODEL`, `GROOSZY_EXPLAIN_API_KEY`, `GROOSZY_EXPLAIN_TIMEOUT` |
| Chat | `GROOSZY_CHAT_URL`, `GROOSZY_CHAT_API_KEY`, `GROOSZY_CHAT_TIMEOUT` |
| Monthly reminder | `SMTP_ADDR`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, `SMTP_TO`, `REMINDER_TZ` |
| Metrics | `METRICS_ADDR` (unset disables the listener) |

See the [API reference](API.md) for defaults and full descriptions.
Keep the metrics listener on a private network and restrict access at the
network level.

### Bank statement import

Export a statement from the Alinma or Al Rajhi app, then upload the XLSX or PDF
file. The parser checks the statement's opening and closing balances, deposit
and withdrawal counts, and deposit and withdrawal totals. Failed checks reject
the import. The uploaded file is parsed in memory and is not saved as a file.

The CLI accepts one export and reports whether it reconciles:

```bash
go run ./cmd/statement statements/<file>.xlsx
go run ./cmd/statement "statements/<file>.pdf" --json=out.json
```

Exit code `0` means the statement reconciled. Exit code `1` means the import
was rejected. Exit code `2` means the file could not be read or parsed.

### AI integrations

AI explainers are off until you configure a provider URL, model, and key. They
send allowlisted aggregates only. Chat can use the explainer provider or a
shared chat service. See the [explainer guide](EXPLAINERS.md) and
[chat guide](CHAT.md).

### Monthly email

Set `SMTP_*` and `REMINDER_TZ` to send a monthly reminder. Without `SMTP_ADDR`,
the reminder is disabled. See the [reminder guide](REMINDERS.md).

## Development

Run the Go, web, and browser tests:

```bash
DATABASE_URL="$DATABASE_URL" go test -race ./...

cd web
npm ci
npm test
npm run build

cd ..
npm ci
npm run test:e2e
```

Database tests skip when `DATABASE_URL` is unset. They create and drop their
own schema.

## Deployment and operations

The API and web images are defined in `Dockerfile.api` and `web/Dockerfile`.
The [operations guide](OPERATIONS.md) covers test issuer setup, Kubernetes,
health checks, logs, and test deployments.

## Privacy

Uploads are parsed in memory. The database stores transactions, account data,
and a file hash, but not statement files. Optional AI requests receive only the
documented aggregates. See the [privacy guide](PRIVACY.md) for stored, logged,
and transmitted data.
