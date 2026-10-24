# API image

`Dockerfile.api` builds the Go API into a distroless static image. The final
stage has no shell, no source tree, and runs as numeric UID 65532.

## Build and run locally

```
docker build -f Dockerfile.api -t grooszy-api:test .
docker run --rm \
  -e DATABASE_URL='postgres://postgres:test@localhost:5432/test?sslmode=disable' \
  -e OIDC_ISSUER='https://kc.example.com/realms/homelab' \
  -e OIDC_OWNER_SUBJECT='00000000000000000000000000' \
  -p 18080:8080 \
  grooszy-api:test
```

Inside the container `localhost` is the container, not your machine. To reach a
database or Keycloak on the host, use `DATABASE_URL=postgres://postgres:test@host.docker.internal:5432/test?sslmode=disable`.

## Environment

| Variable | Required | Meaning |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `OIDC_ISSUER` | yes | Keycloak realm issuer URL |
| `OIDC_OWNER_SUBJECT` | yes | Keycloak subject of the one allowed user |
| `OIDC_AUDIENCE` | no | Default `grooszy` |
| `LISTEN_ADDR` | no | Default `:8080` |
| `MAX_UPLOAD_BYTES` | no | Default 16 MiB |

The API refuses to start when a required value is missing.

## Published tags

The `image` job in `.github/workflows/go.yml` runs on pushes to `main`, after
the test job passes. It pushes to:

```
ghcr.io/alialjaffer/grooszy-api:<commit sha>
ghcr.io/alialjaffer/grooszy-api:latest
```

The repository name is lowercased because GHCR and docker reject uppercase.
Each image carries the `org.opencontainers.image.source` and
`org.opencontainers.image.revision` labels.
