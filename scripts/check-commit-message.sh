#!/usr/bin/env bash
set -euo pipefail

msg=$(grep -v '^#' "$1" || true)

fail() {
  echo "commit message rejected: $1" >&2
  exit 1
}

printf '%s' "$msg" | grep -qi 'co-authored-by' && fail "remove the Co-Authored-By line"
printf '%s' "$msg" | grep -qiE 'generated with|claude code' && fail "remove the tool attribution"
printf '%s' "$msg" | grep -q '—' && fail "no em-dashes"

lines=$(printf '%s\n' "$msg" | sed '/^[[:space:]]*$/d' | wc -l | tr -d ' ')
[ "$lines" -le 1 ] || fail "use a one-line message"

sentences=$(printf '%s' "$msg" | { grep -oE '[.!?]([[:space:]]|$)' || true; } | wc -l | tr -d ' ')
[ "$sentences" -le 2 ] || fail "use at most two sentences"
