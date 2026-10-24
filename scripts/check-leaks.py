#!/usr/bin/env python3
"""Refuse a commit that carries private statement data.

Staged text is scanned for two things:

- Identifiers read from the statements in statements/, when that directory
  exists: the account holder name, IBAN, account number, and reference numbers
  from transaction descriptions.
- Any Saudi IBAN whose digits are not an obvious dummy pattern.

A report names the file, the line, and the kind of match. The matched value is
never printed, so the hook cannot repeat the data it exists to hide.

Exit code 1 means the commit must not proceed.
"""

import json
import os
import re
import subprocess
import sys
import tempfile

IBAN = re.compile(r"SA\d{2}(?:\s*\d){20}")
REFERENCE = re.compile(r"\d{8,}")

# A synthetic IBAN repeats one digit or ends in a rising run. No real account
# does, and the pattern is checked structurally so no value needs storing here.
DUMMY_TAIL = "1234567890123"


def is_dummy(iban):
    digits = re.sub(r"\s", "", iban)[2:]
    return set(digits) == {"0"} or digits.endswith(DUMMY_TAIL)


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
    """Identifiers from the local statements as (needle, label). Absent is fine."""
    if not os.path.isdir("statements"):
        return []
    with tempfile.TemporaryDirectory() as tmp:
        binary = os.path.join(tmp, "statement")
        build = subprocess.run(
            ["go", "build", "-o", binary, "./cmd/statement"], capture_output=True
        )
        if build.returncode != 0:
            return []
        terms = {}
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
            for field, label in (
                ("customer_name", "the account holder name"),
                ("account_number", "the account number"),
            ):
                if data.get(field):
                    terms.setdefault(data[field].lower(), label)
            if data.get("iban"):
                terms.setdefault(data["iban"].replace(" ", "").lower(), "the IBAN")
            for tx in data.get("transactions", []):
                for ref in REFERENCE.findall(tx.get("description_raw", "")):
                    terms.setdefault(ref.lower(), "a reference number")
        return [(k, v) for k, v in terms.items() if len(k) >= 4]


def line_of(text, index):
    return text.count("\n", 0, index) + 1


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
            if not is_dummy(match.group(0)):
                problems.append(
                    f"{path}:{line_of(text, match.start())}: Saudi IBAN that is not a dummy value"
                )
        lowered = text.lower()
        for needle, label in terms:
            at = lowered.find(needle)
            if at >= 0:
                problems.append(f"{path}:{line_of(text, at)}: matches {label} from statements/")

    if not problems:
        return 0
    print("refused: private statement data in the staged files", file=sys.stderr)
    for problem in dict.fromkeys(problems):
        print(f"  {problem}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    if sys.argv[1:] == ["--self-check"]:
        assert is_dummy("SA" + "0" * 22)
        assert is_dummy("SA" + "00" + "0" * 7 + DUMMY_TAIL)
        assert not is_dummy("SA" + "01" + "9" * 20)
        print("ok")
        sys.exit(0)
    sys.exit(main())
