<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/header-dark.svg">
  <img src="docs/assets/header-light.svg" alt="grooszy: private, self-hosted analysis of Saudi bank statements">
</picture>

# grooszy

[![go](https://img.shields.io/github/actions/workflow/status/aliAljaffer/grooszy/go.yml?branch=main&label=go&labelColor=14140f&color=a3e635)](https://github.com/aliAljaffer/grooszy/actions/workflows/go.yml)
[![web](https://img.shields.io/github/actions/workflow/status/aliAljaffer/grooszy/web.yml?branch=main&label=web&labelColor=14140f&color=a3e635)](https://github.com/aliAljaffer/grooszy/actions/workflows/web.yml)

Imports Alinma XLSX and Al Rajhi PDF exports, refuses any statement that does not
reconcile against its own header, blocks duplicate imports, and explains spending
in plain language.

Go for parsing, storage, and suggestions. Next.js for the interface.
PostgreSQL for storage. No statement data leaves the deployment.

## Status

Working single-owner deployment. The Go parsers, the import and read API, and
the web interface are built and tested. The interface covers overview,
transactions, imports, suggestions, chat, and settings.

## Requirements

Go 1.25, Node 22, PostgreSQL 17, Docker (for the database), and an OIDC issuer
such as Keycloak. The API refuses to start without an issuer and an owner
subject.

## Quick start

1. Start PostgreSQL:

```bash
docker run -d --name expense-db -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test -p 5432:5432 postgres:17
export DATABASE_URL='postgres://postgres:test@localhost:5432/test?sslmode=disable'
```

2. Run the API. It applies the migrations on start and listens on `:8080`:

```bash
export OIDC_ISSUER=https://kc.example.com/realms/homelab
export OIDC_AUDIENCE=grooszy
export OIDC_OWNER_SUBJECT=<keycloak subject of the only allowed user>
go run ./cmd/api
```

3. Run the web app:

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

`docs/OPERATIONS.md` covers the rest: a local test issuer, Kubernetes, health
checks, and logs. `docs/API.md` lists every environment variable.

## Tests

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

Without `DATABASE_URL` the database tests skip. They build and drop their own
schema.

## Layout

| Path | Contents |
|---|---|
| `parsers/` | Statement parsers, one Go package per bank |
| `cmd/statement/` | CLI: parse one export, report reconciliation, optional JSON |
| `cmd/api/` | Owner-only import and read API |
| `internal/` | API authentication, import workflow, database access |
| `api/migrations/` | Versioned PostgreSQL schema |
| `web/` | Next.js interface, tests, and brand assets |
| `web/design/` | App colour tokens, generated theme, brand rules |
| `docs/` | Design and operating notes |
| `scripts/` | Commit hooks and the statement leak check |

## Scope

Statement import first. The user exports a file from the bank app and uploads
it. No credentials are stored and no aggregator contract is needed.

An open banking feed through a SAMA-licensed aggregator can be added later
behind the same normalization layer.

## Design

The app palette is `web/design/tokens.json`, and every colour in a component
comes from a semantic token in the generated `web/design/theme.css`. The brand
rules are in `web/design/BRAND.md`, and `web/design/DESIGN.md` records the
resolved design decisions and the checks that were run.

The design kit that generates and validates the palette is not vendored, so
token and contrast checks run in the maintainer's environment, not in CI. Do
not edit `theme.css` by hand.

## Privacy

Real statements live in `statements/`, which Git ignores. Every example in
`docs/` is synthetic. `scripts/check-leaks.py` refuses a commit that carries a
real identifier, and the hook runs it before every commit. `docs/PRIVACY.md`
lists exactly what is stored, logged, and sent out of the process.

## Licence

MIT. See `LICENSE`.
