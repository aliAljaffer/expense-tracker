#!/usr/bin/env bash
set -euo pipefail

if ! command -v gitleaks >/dev/null 2>&1; then
    echo "gitleaks not found, skipping: brew install gitleaks"
    exit 0
fi

if gitleaks dir --help >/dev/null 2>&1; then
    exec gitleaks dir . --config .gitleaks.toml --redact --no-banner
fi
exec gitleaks detect --no-git -c .gitleaks.toml --redact
