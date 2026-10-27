# Operations

How the two processes run today, what each one needs, and what to watch. Every
value here comes from this repository. A fact that is not in the repository is
marked `not in this repository`.

## Processes

| Process | Entry point | Port | Container |
|---|---|---|---|
| API | `cmd/api` | 8080 by default, `LISTEN_ADDR` | `Dockerfile.api` |
| Web | Next.js app in `web/` | 3000 | `web/Dockerfile` |

The web container runs the standalone build with `node server.js`
(`web/Dockerfile`). The API container runs the static binary as a non-root user
and exposes 8080 (`Dockerfile.api`).

## What the API needs

Required. The API exits at startup when one is missing.

| Variable | Meaning |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `OIDC_ISSUER` | Keycloak realm issuer URL |
| `OIDC_OWNER_SUBJECT` | Keycloak subject of the only allowed user |

Optional:

| Variable | Default | Meaning |
|---|---|---|
| `OIDC_AUDIENCE` | `grooszy` | Audience the token must carry |
| `LISTEN_ADDR` | `:8080` | Listen address |
| `MAX_UPLOAD_BYTES` | 16 MiB | Largest accepted upload |
| `SMTP_*`, `REMINDER_TZ` | none | Monthly reminder. See `docs/REMINDERS.md` |
| `GROOSZY_EXPLAIN_*` | none | LLM explainer. See `docs/EXPLAINERS.md` |

The API calls the issuer discovery endpoint at startup with a 30 second timeout
(`cmd/api/main.go`). An unreachable issuer stops the API.

## What the web app needs

`web/src/lib/auth/config.ts` requires these five values:

| Variable | Meaning |
|---|---|
| `OIDC_ISSUER` | Same issuer the API uses |
| `OIDC_CLIENT_ID` | Keycloak client ID |
| `SESSION_SECRET` | Encrypts the session cookie |
| `APP_ORIGIN` | Public origin of the app, used for the OIDC redirect and cookie flags |
| `API_BASE_URL` | API base URL as reached from the web server |

`OIDC_CLIENT_SECRET` is optional. A missing required value throws on first use.

The session cookie is encrypted with AES-256-GCM from `SESSION_SECRET`
(`web/src/lib/auth/session.ts`). Changing the secret makes existing cookies
unreadable, which signs the owner out. The value is not in this repository.

## API startup

From `cmd/api/main.go`:

1. Read the environment. A missing required value stops the process.
2. Open the database pools for imports and ledger reads.
3. Apply migrations. A failure logs `apply migrations` and exits with code 1.
4. Backfill merchants.
5. Discover the issuer keys.
6. Clean stale import previews, then every 6 hours.
7. Start the reminder loop.
8. Listen on `LISTEN_ADDR`.

### Migrations

The API applies `api/migrations/*.up.sql` from a filesystem embedded in the
binary (`api/migrations/migrations.go`). `schema_migrations` records each
version, and an applied version is skipped. Each file runs in its own
transaction (`internal/migrate/migrate.go`). A failed file rolls back and stops
the API.

There are four migration pairs at this commit: `0001_init`, `0002_import_preview`,
`0003_bnpl_detection`, and `0004_settings`. Let the API apply them, or apply
them by hand before the first start (`docs/API.md`). Do not edit a file that has
already been applied.

## Local run

These commands start a database and two servers. They were not run for this
document.

### 1. Start PostgreSQL

```bash
docker run -d --name expense-db \
  -e POSTGRES_PASSWORD=test \
  -e POSTGRES_DB=test \
  -p 5432:5432 postgres:17
```

### 2. Export the database URL

```bash
export DATABASE_URL='postgres://postgres:test@localhost:5432/test?sslmode=disable'
```

### 3. Start the test issuer

Warning: the test issuer is for local use only. It issues a token for the fixed
subject `test-subject-123` to anyone who completes the flow. Never expose it
outside your machine.

```bash
ISSUER_URL=http://127.0.0.1:8900 node web/e2e/support/test-issuer.mjs
```

The issuer URL must match `OIDC_ISSUER` exactly. A mismatch makes the API
reject the discovery document.

### 4. Start the API

```bash
export OIDC_ISSUER=http://127.0.0.1:8900
export OIDC_AUDIENCE=test-client
export OIDC_OWNER_SUBJECT=test-subject-123
go run ./cmd/api
```

The API applies migrations on start. It listens on `:8080`.

### 5. Start the web app

```bash
cd web
npm ci
OIDC_ISSUER=http://127.0.0.1:8900 \
OIDC_CLIENT_ID=test-client \
SESSION_SECRET=local-dev-secret-at-least-32-characters \
APP_ORIGIN=http://127.0.0.1:3000 \
API_BASE_URL=http://127.0.0.1:8080 \
npm run dev
```

Open `http://127.0.0.1:3000` and sign in through the test issuer.

`web/e2e/support/start-servers.mjs` starts the issuer, an API, and the web app
together for the browser tests. With `USE_REAL_API=1` it runs the Go API and
applies migrations first through `go run ./cmd/run-e2e-migrations`.

The Playwright suite starts those servers itself. Build the web app first
(`npm run build` in `web/`), then run `npm run test:e2e` from the repository
root. That script runs `playwright test` (`package.json`).

## Kubernetes today

Only the dev manifests are in this repository, in `deploy/dev/`. The namespace
is `grooszy-dev` with restricted pod security (`deploy/dev/01-namespace.yaml`).

| Object | File | Notes |
|---|---|---|
| Cluster `grooszy-db` | `02-cnpg-cluster.yaml` | CloudNativePG, one instance, PostgreSQL 17.5, 10Gi on `longhorn`, database `grooszy` owned by `grooszy` |
| Deployment `grooszy-api` | `04-api-deployment.yaml` | One replica, image pinned by digest, probes on `/healthz` and `/readyz` |
| Service `grooszy-api` | `04-api-service.yaml` | Port 8080 |
| Deployment `grooszy-web` | `05-web-deployment.yaml` | One replica, image pinned by digest, probes on `/signin` |
| Service `grooszy-web` | `05-web-service.yaml` | Port 3000 |
| Deployment, Service, ConfigMap `test-issuer` | `03-*.yaml` | Test OIDC issuer for this namespace only |

Apply and check:

```bash
kubectl apply -f deploy/dev/
kubectl -n grooszy-dev get pods
```

The cluster needs the CloudNativePG operator and a `longhorn` storage class,
which the cluster manifest names. The database does not bootstrap until secret
`grooszy-postgres` exists. The API pod does not start until secret `grooszy-app`
exists. The web pod does not start until secret `web-session-secret` exists.

Reach the UI:

```bash
kubectl -n grooszy-dev port-forward svc/grooszy-web 3000:3000
```

No Ingress or HTTPRoute is in this repository.

### Database connection

The API reads `DATABASE_URL` from secret `grooszy-app`, key `uri`
(`deploy/dev/04-api-deployment.yaml`). The cluster bootstraps database
`grooszy` with owner `grooszy` through bootstrap secret `grooszy-postgres`
(`deploy/dev/02-cnpg-cluster.yaml`). How `grooszy-app` is created is
`not in this repository`.

### Web session secret

The web deployment reads `SESSION_SECRET` from secret `web-session-secret`, key
`secret` (`deploy/dev/05-web-deployment.yaml`). Its value is
`not in this repository`.

### Production

Production manifests are `not in this repository`. They live on a branch of the
homelab repository that is not merged. `docs/KEYCLOAK-CLIENT.md` describes the
Keycloak setup for that deployment. The production namespace, host name, ingress,
and replica count are `not in this repository`.

## Browser tests against the cluster

```bash
bash scripts/e2e-cluster.sh
```

The script port-forwards the web app, the test issuer, and the API, then runs
Playwright. It needs the `grooszy-dev` namespace and `kubectl` access.

Warning: `--reset-db` truncates every table in the `grooszy` database before
the run (`scripts/e2e-cluster.sh`). Do not use it against a database you want
to keep.

## Migration check

```bash
bash scripts/check-migrations.sh
```

The script starts a temporary `postgres:17-alpine` container, applies every up
migration, applies every down migration in reverse order, then applies the up
migrations again. It fails when a pair is missing or a file does not apply.

## Health endpoints

| Endpoint | Checks | Healthy | Unhealthy |
|---|---|---|---|
| `GET /healthz` | Nothing | 200 `{"status":"ok"}` | Never |
| `GET /readyz` | Database ping | 200 `{"status":"ready"}` | 503 `{"error":"database unavailable"}` |

Both are public. The API probes use them
(`deploy/dev/04-api-deployment.yaml`). The web probes use `GET /signin`, which
does not require a session.

## Reminder loop

The API sends an optional email on the first of the month. The loop wakes once
an hour and once at startup. It stores the month in `reminder_last_sent` after a
successful send. With `SMTP_ADDR` unset it logs one line and does nothing else.
See `docs/REMINDERS.md`.

## Logs

The API writes JSON to stdout through `slog`, one object per line
(`cmd/api/main.go`). Watch these messages:

| Message | Level | Meaning |
|---|---|---|
| `api listening` | info | HTTP server is up. `addr` is the listen address |
| `monthly reminder enabled` | info | SMTP is configured. `timezone` is `REMINDER_TZ` |
| `monthly reminder disabled, SMTP_ADDR is not set` | info | Expected when reminders are off |
| `monthly reminder sent` | info | The SMTP server accepted the message |
| `send monthly reminder failed` | warn | The send failed. It retries on the next hourly check |
| `read reminder state failed` | warn | The database read failed |
| `read reminder email failed` | warn | The database read failed |
| `record reminder sent failed` | warn | The email went out but the month was not stored |
| `send test reminder failed` | warn | The test endpoint returned 502 |
| `apply migrations` | error | The schema did not apply. The process exits |
| `import preview` | info | An upload parsed. Includes import id, row count, status |
| `import committed` | info | Rows were stored. Includes import id, inserted, skipped |
| `preview cleanup failed` | warn | Stale previews were not removed |

No request bodies, statement contents, account numbers, or amounts are logged
(`internal/httpapi/server.go`). The migration failure log redacts the
credentials in `DATABASE_URL` (`cmd/api/main.go`).

## Not in this repository

- Production manifests and the unmerged homelab branch.
- The values of `grooszy-app`, `grooszy-postgres`, and `web-session-secret`.
- Redis. The code has no Redis client, setting, or mention.
- Metrics. There is no `/metrics` endpoint and no Prometheus configuration.
- A backup schedule. See `docs/BACKUPS.md`.
- Keycloak realm and client setup. See `docs/KEYCLOAK-CLIENT.md`.
