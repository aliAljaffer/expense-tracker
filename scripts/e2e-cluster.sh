#!/bin/bash
set -euo pipefail

NAMESPACE="expense-tracker-dev"
RESET_DB=0

for arg in "$@"; do
  case "$arg" in
    --reset-db)
      RESET_DB=1
      ;;
  esac
done

reset_database() {
  if [ $RESET_DB -eq 0 ]; then
    return 0
  fi

  echo "Resetting database..."
  kubectl exec -n "$NAMESPACE" deployment/expense-tracker-db-1 -- psql -U postgres -d test -c "
    DROP TABLE IF EXISTS transactions CASCADE;
    DROP TABLE IF EXISTS imports CASCADE;
    DROP TABLE IF EXISTS accounts CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
  " || echo "Warning: some tables may not exist"
  echo "✓ Database reset complete"
}

echo "Resetting database if requested..."
reset_database

POD_NAME="e2e-test-$$"
echo "Creating temporary test pod: $POD_NAME"

cat > /tmp/e2e-pod.yaml << 'YAML'
apiVersion: v1
kind: Pod
metadata:
  name: POD_NAME_PLACEHOLDER
  namespace: NAMESPACE_PLACEHOLDER
spec:
  containers:
  - name: test-runner
    image: mcr.microsoft.com/playwright:v1.48.0-focal
    workingDir: /app
    securityContext:
      allowPrivilegeEscalation: false
      runAsNonRoot: true
      runAsUser: 1000
      capabilities:
        drop:
        - ALL
      seccompProfile:
        type: RuntimeDefault
    env:
    - name: CLUSTER
      value: "1"
    - name: OIDC_ISSUER
      value: http://test-issuer.expense-tracker-dev.svc:8900
    - name: APP_ORIGIN
      value: http://expense-tracker-web.expense-tracker-dev.svc:3000
    - name: API_BASE_URL
      value: http://expense-tracker-api.expense-tracker-dev.svc:8080
    volumeMounts:
    - name: app
      mountPath: /app
    - name: tmp
      mountPath: /tmp
  volumes:
  - name: app
    emptyDir: {}
  - name: tmp
    emptyDir: {}
  restartPolicy: Never
YAML

sed -i.bak "s/POD_NAME_PLACEHOLDER/$POD_NAME/g; s/NAMESPACE_PLACEHOLDER/$NAMESPACE/g" /tmp/e2e-pod.yaml

trap "kubectl delete pod -n $NAMESPACE $POD_NAME 2>/dev/null || true" EXIT

echo "Applying pod manifest..."
kubectl apply -f /tmp/e2e-pod.yaml

echo "Waiting for pod to be ready (max 120s)..."
kubectl wait --for=condition=Ready pod/$POD_NAME -n $NAMESPACE --timeout=120s 2>/dev/null || {
  echo "Pod failed to become ready. Checking logs..."
  kubectl logs -n $NAMESPACE $POD_NAME || true
  exit 1
}

echo "Copying application files into pod..."
tar czf - \
  --exclude=node_modules \
  --exclude=.next \
  --exclude=.git \
  --exclude=statements \
  web/e2e web/package.json web/package-lock.json playwright.config.ts | \
  kubectl exec -i -n $NAMESPACE $POD_NAME -- tar xzf -

echo "Installing dependencies in pod..."
kubectl exec -n $NAMESPACE $POD_NAME -- npm ci

echo "Running Playwright tests..."
kubectl exec -n $NAMESPACE $POD_NAME -- npx playwright test "$@" --reporter=line --workers=1

echo "Test run complete"
