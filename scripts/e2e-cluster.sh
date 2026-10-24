#!/bin/bash
set -euo pipefail

NAMESPACE="expense-tracker-dev"
RESET_DB=0
PLAYWRIGHT_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --reset-db)
      RESET_DB=1
      ;;
    *)
      PLAYWRIGHT_ARGS+=("$arg")
      ;;
  esac
done

echo "Starting port-forwards..."

kubectl port-forward -n "$NAMESPACE" svc/expense-tracker-web 3000:3000 > /dev/null 2>&1 &
WEB_PF_PID=$!

kubectl port-forward -n "$NAMESPACE" svc/test-issuer 8900:8900 > /dev/null 2>&1 &
ISSUER_PF_PID=$!

kubectl port-forward -n "$NAMESPACE" svc/expense-tracker-api 8901:8080 > /dev/null 2>&1 &
API_PF_PID=$!

cleanup() {
  echo "Cleaning up port-forwards..."
  kill $WEB_PF_PID 2>/dev/null || true
  kill $ISSUER_PF_PID 2>/dev/null || true
  kill $API_PF_PID 2>/dev/null || true
  wait $WEB_PF_PID 2>/dev/null || true
  wait $ISSUER_PF_PID 2>/dev/null || true
  wait $API_PF_PID 2>/dev/null || true
}

trap cleanup EXIT

wait_for_port() {
  local port=$1
  local max_attempts=60
  local attempt=0

  echo "Waiting for port $port..."
  while [ $attempt -lt $max_attempts ]; do
    if curl -s http://127.0.0.1:$port > /dev/null 2>&1; then
      echo "Port $port ready"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done

  echo "Port $port failed to become ready after $max_attempts seconds"
  return 1
}

reset_database() {
  if [ $RESET_DB -eq 0 ]; then
    return 0
  fi

  echo "Resetting database..."
  kubectl exec -n "$NAMESPACE" expense-tracker-db-1 -c postgres -- psql -U postgres -d expense-tracker << 'EOF'
TRUNCATE TABLE account CASCADE;
TRUNCATE TABLE category CASCADE;
TRUNCATE TABLE debt CASCADE;
TRUNCATE TABLE import_preview CASCADE;
TRUNCATE TABLE merchant CASCADE;
TRUNCATE TABLE merchant_alias CASCADE;
TRUNCATE TABLE recurring_series CASCADE;
TRUNCATE TABLE shared_expense CASCADE;
TRUNCATE TABLE statement_import CASCADE;
TRUNCATE TABLE suggestion CASCADE;
TRUNCATE TABLE transaction CASCADE;
TRUNCATE TABLE user_decision CASCADE;
EOF
  echo "Database reset complete"
}

wait_for_port 3000
wait_for_port 8900
wait_for_port 8901

reset_database

echo "Running Playwright tests..."
export CLUSTER=1
npx playwright test "${PLAYWRIGHT_ARGS[@]}" --reporter=line --workers=1
