#!/usr/bin/env bash
set -euo pipefail

root=$(cd "$(dirname "$0")/.." && pwd)
dir="$root/api/migrations"
psql=(psql -X -q -v ON_ERROR_STOP=1 -U postgres -d postgres)

container=$(docker run -d --rm \
  -e POSTGRES_PASSWORD=migrations-only \
  -e POSTGRES_HOST_AUTH_METHOD=trust \
  -p 127.0.0.1::5432 \
  postgres:17-alpine)

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for _ in $(seq 1 60); do
  if docker exec "$container" pg_isready -U postgres -q 2>/dev/null; then
    break
  fi
  sleep 1
done

if ! docker exec "$container" pg_isready -U postgres -q; then
  echo "FAIL: postgres did not become ready" >&2
  exit 1
fi

echo "port: $(docker port "$container" 5432/tcp)"
echo "version: $(docker exec "$container" psql -X -tA -U postgres -d postgres -c 'show server_version')"

shopt -s nullglob
ups=("$dir"/*.up.sql)
downs=("$dir"/*.down.sql)

if [ ${#ups[@]} -eq 0 ]; then
  echo "FAIL: no *.up.sql in $dir" >&2
  exit 1
fi

for up in "${ups[@]}"; do
  down="${up%.up.sql}.down.sql"
  if [ ! -f "$down" ]; then
    echo "FAIL: $up has no down migration" >&2
    exit 1
  fi
done

run() {
  echo "apply $1"
  if ! docker exec -i "$container" "${psql[@]}" -f - < "$file"; then
    echo "FAIL: $1" >&2
    exit 1
  fi
}

for file in "${ups[@]}"; do
  run "up   $(basename "$file")"
done

for ((i = ${#downs[@]} - 1; i >= 0; i--)); do
  file="${downs[$i]}"
  run "down $(basename "$file")"
done

for file in "${ups[@]}"; do
  run "up   $(basename "$file")"
done

echo "tables: $(docker exec "$container" psql -X -tA -U postgres -d postgres \
  -c "select count(*) from pg_tables where schemaname = 'public'")"
echo "OK"
