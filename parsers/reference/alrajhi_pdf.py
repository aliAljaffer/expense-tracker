"""Parse an Al Rajhi 'Account Statement' PDF.

Identify the bank from the IBAN, not from bank names in the body. Bank code 80
is Al Rajhi. An inward transfer quotes the SENDING bank's BIC, so a statement
full of SAINMAINMA2BXXX is still an Al Rajhi statement.

Requires the pdftotext binary from poppler (brew install poppler).

Usage:
    python3 alrajhi_pdf.py "PDF document-*.pdf" [--json out.json]
"""

import json
import re
import shutil
import subprocess
import sys
import tempfile

from common import Kind, Statement, Transaction, bank_from_iban, print_report

TYPES = [
    "POS purchase Apple pay (Domestic)",
    "POS purchase Apple pay (International)",
    "Online purchase Apple pay (Domestic)",
    "Online purchase Apple pay (International)",
    "POS purchase Atheer (Domestic)",
    "Internal Transfer",
    "Inward IPS Credit Transfer",
    "Outward IPS Credit Transfer",
    "Outward IPS Credit Transaction Charges",
    "Debit - Credit Cards Transactions",
    "Sadad Payments",
    "Visa Payment",
    "Credit Salary",
    "ATM Deposit",
    "ATM Withdrawal",
    "Cash Withdrawal",
    "Dynamic Currencies Debit Card Markup",
    "Kiosk - ATM Card Renewal Fees",
    "Message to beneficiary",
]

TYPE_KINDS = {
    "POS purchase Apple pay (Domestic)": Kind.CARD_PURCHASE,
    "POS purchase Atheer (Domestic)": Kind.CARD_PURCHASE,
    "POS purchase Apple pay (International)": Kind.INTL_PURCHASE,
    "Online purchase Apple pay (Domestic)": Kind.ONLINE_PURCHASE,
    "Online purchase Apple pay (International)": Kind.INTL_PURCHASE,
    "Internal Transfer": Kind.INTERNAL_TRANSFER,
    "Inward IPS Credit Transfer": Kind.EXTERNAL_TRANSFER_IN,
    "Outward IPS Credit Transfer": Kind.EXTERNAL_TRANSFER_OUT,
    "Outward IPS Credit Transaction Charges": Kind.FEE,
    "Kiosk - ATM Card Renewal Fees": Kind.FEE,
    "Dynamic Currencies Debit Card Markup": Kind.FEE,
    "Message to beneficiary": Kind.FEE,
    "Debit - Credit Cards Transactions": Kind.CARD_PAYMENT,
    "Sadad Payments": Kind.BILL_PAYMENT,
    "Credit Salary": Kind.SALARY,
    "ATM Deposit": Kind.CASH_DEPOSIT,
    "ATM Withdrawal": Kind.CASH_WITHDRAWAL,
    "Cash Withdrawal": Kind.CASH_WITHDRAWAL,
    "Visa Payment": Kind.REFUND,
}

AMOUNTS = re.compile(r"([\d,]+\.\d{2}) SAR\s+([\d,]+\.\d{2}) SAR\s+(-?[\d,]+\.\d{2}) SAR\s*$")
DATE = re.compile(r"^\s*(\d{4}/\d{2}/\d{2})\s")
HEADER_NUM = re.compile(r"([\d,]+\.\d{2})\s*SAR")


def to_text(path: str) -> list:
    if not shutil.which("pdftotext"):
        raise RuntimeError("pdftotext not found; install poppler")
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as fh:
        out = fh.name
    # -layout keeps the amount columns aligned; without it they interleave.
    subprocess.run(["pdftotext", "-layout", path, out], check=True)
    with open(out, encoding="utf-8") as fh:
        return [line.rstrip() for line in fh]


def _header(lines: list, stmt: Statement) -> None:
    text = "\n".join(lines[:80])

    def grab(label, rx):
        m = re.search(label + r"\s+" + rx, text)
        return m.group(1) if m else None

    stmt.customer_name = grab("Customer Name", r"(.+?)\s{2,}")
    stmt.account_number = grab("Account Number", r"(\d+)")
    stmt.iban = grab("IBAN Number", r"(SA\d+)")
    stmt.bank = bank_from_iban(stmt.iban)
    opening = grab("Opening Balance", r"([\d,]+\.\d{2}) SAR")
    closing = grab("Closing Balance", r"([\d,]+\.\d{2}) SAR")
    deposits = grab("Number Of Deposits", r"(\d+)")
    withdrawals = grab("Number Of Withdrawals", r"(\d+)")
    total_dep = grab("Total Deposits", r"([\d,]+\.\d{2}) SAR")
    total_wd = grab("Total Withdrawals", r"([\d,]+\.\d{2}) SAR")

    def f(v):
        return float(v.replace(",", "")) if v else None

    stmt.opening_balance = f(opening)
    stmt.closing_balance = f(closing)
    stmt.stated_credit_count = int(deposits) if deposits else None
    stmt.stated_debit_count = int(withdrawals) if withdrawals else None
    stmt.stated_credit_total = f(total_dep)
    stmt.stated_debit_total = f(total_wd)

    period = re.search(r"(\d{4}/\d{2}/\d{2})\s+-\s+(\d{4}/\d{2}/\d{2})", text)
    if period:
        stmt.period_start, stmt.period_end = period.group(1), period.group(2)


def _merchant(notes: str, kind: str) -> str:
    n = re.sub(r"^.*?Notes:", "", notes)
    n = re.sub(r"^Time:\d{2}:\d{2}:\d{2},\s*", "", n)
    # Leading (terminal-reference) pair is routing data, not the merchant.
    n = re.sub(r"^\(\d+-\d+\)\s*", "", n)
    n = re.sub(r"^Online Purchase from ", "", n)
    n = re.split(r",\s*[A-Z][A-Za-z ]*,\s*SA\b", n)[0]
    n = re.split(r"\s+[\d,]+\.\d{2} SAR", n)[0]
    return re.sub(r"\s+", " ", n).strip(" ,")


def classify(t: Transaction, title: str) -> Transaction:
    t.kind = TYPE_KINDS.get(title, Kind.UNKNOWN)

    if t.kind == Kind.BILL_PAYMENT:
        m = re.search(r"W#(\d+)-\d+\s*-(\d+)", t.description_raw)
        if m:
            t.biller_code, t.biller_account = m.group(1), m.group(2)
        return t

    if t.kind == Kind.CARD_PAYMENT:
        m = re.search(r"(?:ending -|\*{6})\s*(\d{4})", t.description_raw)
        if m:
            t.card_last4 = m.group(1)
        return t

    if t.kind in (Kind.CARD_PURCHASE, Kind.ONLINE_PURCHASE, Kind.INTL_PURCHASE):
        t.merchant_raw = _merchant(t.description_raw, t.kind)
        return t

    if t.kind in (Kind.EXTERNAL_TRANSFER_OUT, Kind.EXTERNAL_TRANSFER_IN):
        body = re.sub(r"^.*?Notes:", "", t.description_raw)
        m = re.search(r"\d+/([^/]+?)(?:\s+[\d,]+\.\d{2} SAR|$)", body)
        if m:
            t.merchant_raw = m.group(1).strip()
    return t


def parse(path: str) -> Statement:
    lines = to_text(path)
    stmt = Statement(source_path=path)
    _header(lines, stmt)

    seen = set()
    for i, line in enumerate(lines):
        m = AMOUNTS.search(line)
        if not m:
            continue
        debit, credit, balance = (float(g.replace(",", "")) for g in m.groups())

        # The amount triple can sit on the date line or several lines below it,
        # so anchor on the amounts and walk backwards.
        date, date_i = None, i
        for j in range(i, max(-1, i - 9), -1):
            dm = DATE.match(lines[j])
            if dm:
                date, date_i = dm.group(1), j
                break
        if date is None:
            continue

        title = None
        for j in range(date_i, max(-1, date_i - 5), -1):
            if lines[j].strip() in TYPES:
                title = lines[j].strip()
                break

        body = lines[date_i] if date_i == i else " ".join(x.strip() for x in lines[date_i:i + 1])
        tail = " ".join(x.strip() for x in lines[i + 1:i + 3])
        if "SAR" in tail or (i + 1 < len(lines) and DATE.match(lines[i + 1])):
            tail = ""
        desc = re.sub(r"\s+", " ", f"{body} {tail}").strip()

        key = (date, debit, credit, balance)
        if key in seen:
            continue
        seen.add(key)

        t = Transaction(
            posted_date=date.replace("/", "-"),
            description_raw=desc,
            debit=debit,
            credit=credit,
            balance_after=balance,
        )
        stmt.transactions.append(classify(t, title or ""))

    return stmt


def main(argv: list) -> int:
    if not argv:
        print(__doc__)
        return 2
    stmt = parse(argv[0])
    ok = print_report(stmt)
    if "--json" in argv:
        out = argv[argv.index("--json") + 1]
        with open(out, "w", encoding="utf-8") as fh:
            json.dump([t.to_dict() for t in stmt.transactions], fh, ensure_ascii=False, indent=2)
        print(f"wrote         {out}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
