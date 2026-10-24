#!/usr/bin/env python3
"""Refuse a commit that carries private statement data.

Staged text is scanned for two things:

- Identifiers taken from the statements in statements/, when that directory
  exists: the account holder name, IBAN, account number, and reference numbers
  from transaction descriptions.
- Any Saudi IBAN that is not on the synthetic allowlist below.

Exit code 1 means the commit must not proceed.
"""

import json
import os
import re
import subprocess
import sys
import tempfile

# Every IBAN used in tests and documentation. Add new synthetic ones here; a
# real IBAN is never added.
SYNTHETIC_IBANS = {
    "SA0000000000000000000000",
    "SA0005000001234567890123",
    "SA0080000001234567890123",
    "SA4410000001234567890123",
}

IBAN = re.compile(r"SA\d{2}(?:\s*\d){20}")
REFERENCE = re.compile(r"\d{8,}")


def git(*args):
    return subprocess.run(["git", *args], capture_output=True)


def staged_files():
    out = git("diff", "--cached", "--name-only", "--diff-filter=ACM", "-z").stdout
    return [p for p in out.decode().split("\0") if p]


def staged_text(path):
    r = git("show", f":{path}")
    if r.returncode != 0:
        return None
    try:
        return r.stdout.decode("utf-8")
    except UnicodeDecodeError:
        return None


def statement_terms():
    """Identifiers from the local statements. Empty when they are absent."""
    if not os.path.isdir("statements"):
        return []
    with tempfile.TemporaryDirectory() as tmp:
        binary = os.path.join(tmp, "statement")
        build = subprocess.run(
            ["go", "build", "-o", binary, "./cmd/statement"], capture_output=True
        )
        if build.returncode != 0:
            return []
        terms = set()
        for name in sorted(os.listdir("statements")):
            path = os.path.join("statements", name)
            if not os.path.isfile(path):
                continue
            out = os.path.join(tmp, "statement.json")
            run = subprocess.run([binary, path, f"--json={out}"], capture_output=True)
            if run.returncode != 0:
                continue
            with open(out, encoding="utf-8") as fh:
                data = json.load(fh)
            for field in ("customer_name", "account_number"):
                if data.get(field):
                    terms.add(data[field])
            if data.get("iban"):
                terms.add(data["iban"].replace(" ", ""))
            for tx in data.get("transactions", []):
                terms.update(REFERENCE.findall(tx.get("description_raw", "")))
        return sorted(terms, key=len, reverse=True)


def main():
    files = staged_files()
    if not files:
        return 0

    problems = []
    if any(f.startswith("statements/") for f in files):
        problems.append("statements/ is private and must never be staged")

    terms = statement_terms()
    for path in files:
        text = staged_text(path)
        if text is None:
            continue
        for match in IBAN.finditer(text):
            if match.group(0).replace(" ", "") not in SYNTHETIC_IBANS:
                problems.append(f"{path}: Saudi IBAN {match.group(0)!r} is not synthetic")
        lowered = text.lower()
        for term in terms:
            if len(term) >= 4 and term.lower() in lowered:
                problems.append(f"{path}: contains statement data {term!r}")
                break

    if not problems:
        return 0
    print("refused: private statement data in the staged files", file=sys.stderr)
    for problem in dict.fromkeys(problems):
        print(f"  {problem}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
