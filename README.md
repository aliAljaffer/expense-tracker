<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/header-dark.svg">
  <img src="docs/assets/header-light.svg" alt="grooszy: private, self-hosted analysis of Saudi bank statements">
</picture>

# grooszy

[![go](https://github.com/aliAljaffer/grooszy/actions/workflows/go.yml/badge.svg)](https://github.com/aliAljaffer/grooszy/actions/workflows/go.yml)
[![Web](https://github.com/aliAljaffer/grooszy/actions/workflows/web.yml/badge.svg)](https://github.com/aliAljaffer/grooszy/actions/workflows/web.yml)

Private, self-hosted analysis of Saudi bank statements. Grooszy imports and
reconciles bank exports without storing uploaded statement files.

Go API and parsers, Next.js web app, PostgreSQL storage.

## Features

Statement import and review, spending analysis, transaction search, financial
suggestions, and optional AI explainers. See the
[installation guide](docs/INSTALLATION_GUIDE.md) for feature details and
integrations.

## Requirements

Go 1.26, Node 22, PostgreSQL 17, Docker, and an OIDC issuer such as Keycloak.

## Quick start

Start PostgreSQL:

```bash
docker run -d --name expense-db -e POSTGRES_PASSWORD=test -e POSTGRES_DB=test -p 5432:5432 postgres:17
export DATABASE_URL='postgres://postgres:test@localhost:5432/test?sslmode=disable'
```

Run the API with your issuer and allowed owner subject:

```bash
export OIDC_ISSUER=https://kc.example.com/realms/homelab
export OIDC_AUDIENCE=grooszy
export OIDC_OWNER_SUBJECT=<keycloak-subject>
go run ./cmd/api
```

Run the web app:

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

See the [installation guide](docs/INSTALLATION_GUIDE.md) for full configuration
and integrations. See the [operations guide](docs/OPERATIONS.md) for test
issuer setup, Kubernetes deployment, health checks, and logs.

## Screenshots

All screenshots use synthetic statement data.

|               Overview                |                  Import review                  |
| :-----------------------------------: | :---------------------------------------------: |
| ![Overview](screenshots/overview.png) | ![Import review](screenshots/import-review.png) |

|                 Suggestions                 |                 Transactions                  |
| :-----------------------------------------: | :-------------------------------------------: |
| ![Suggestions](screenshots/suggestions.png) | ![Transactions](screenshots/transactions.png) |

## Fun fact: App Name

I lived in Poland for three years and liked the wordplay between Polish
_groszy_ (from _grosz_, a cent-like coin pronounced "grosh") and Arabic
_groosh_ ("coins") and _grooshi_ ("my coins"). That wordplay became
**Grooszy**. The AI assistant, **Gersz**, is named after _gersh_, the Arabic
singular of _groosh_.

## Links

- [Installation guide](docs/INSTALLATION_GUIDE.md)
- [API reference](docs/API.md)
- [Privacy guide](docs/PRIVACY.md)
- [License](LICENSE)
