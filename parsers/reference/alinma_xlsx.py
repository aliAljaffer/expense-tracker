"""Parse an Alinma 'Brief Statement of Account' XLSX export.

Reads the workbook with zipfile and ElementTree so no third-party package is
needed.

Usage:
    python3 alinma_xlsx.py STATEMENT_*.xlsx [--json out.json]
"""

import datetime
import json
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

from common import Kind, Statement, Transaction, bank_from_iban, print_report

NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"
EXCEL_EPOCH = datetime.date(1899, 12, 30)
MIN_SERIAL = 40000  # a trailing row repeats the closing balance in the date column


def _col_index(ref: str) -> int:
    letters = "".join(c for c in ref if c.isalpha())
    n = 0
    for c in letters:
        n = n * 26 + (ord(c) - 64)
    return n - 1


def _read_grid(path: str) -> list:
    z = zipfile.ZipFile(path)
    shared = []
    try:
        root = ET.fromstring(z.read("xl/sharedStrings.xml"))
        for si in root.findall(f"{NS}si"):
            shared.append("".join(t.text or "" for t in si.iter(f"{NS}t")))
    except KeyError:
        pass

    sheet = ET.fromstring(z.read("xl/worksheets/sheet1.xml"))
    rows = []
    for row in sheet.iter(f"{NS}row"):
        cells = {}
        for c in row.findall(f"{NS}c"):
            t = c.get("t")
            v = c.find(f"{NS}v")
            if t == "inlineStr":
                node = c.find(f"{NS}is")
                val = "".join(x.text or "" for x in node.iter(f"{NS}t")) if node is not None else ""
            elif v is None:
                val = ""
            elif t == "s":
                val = shared[int(v.text)]
            else:
                val = v.text
            cells[_col_index(c.get("r"))] = val
        if cells:
            rows.append([cells.get(i, "") for i in range(max(cells) + 1)])
    return rows


def _num(s):
    if s in (None, ""):
        return None
    try:
        return float(str(s).replace(",", ""))
    except ValueError:
        return None


def clean(desc: str) -> str:
    """Undo the exporter's line wrapping.

    Wrapped lines are marked with '#', sometimes mid-word, so merchant names
    fragment unless this runs before any regex.
    """
    return re.sub(r"\s+", " ", desc.replace("#", " ")).strip()


def _header(rows: list, stmt: Statement) -> None:
    labels = {
        "Customer Name": "customer_name",
        "Account Number": "account_number",
        "Account Currency": "currency",
        "Opening Balance": "opening_balance",
        "Closing Balance": "closing_balance",
        "Number of Withdraws": "stated_debit_count",
        "Total Withdraws": "stated_debit_total",
        "Number Of Deposits": "stated_credit_count",
        "Totals Deposits": "stated_credit_total",
    }
    numeric = {"opening_balance", "closing_balance", "stated_debit_total", "stated_credit_total"}
    counts = {"stated_debit_count", "stated_credit_count"}

    for row in rows[:10]:
        for i, cell in enumerate(row):
            # Label cells hold the Arabic name, a newline, then the English one,
            # prefixed with a U+202B right-to-left embedding mark.
            label = str(cell).split("\n")[-1].strip().strip("\u202a\u202b\u202c")
            attr = labels.get(label)
            if attr and i + 1 < len(row):
                raw = row[i + 1]
                if attr in numeric:
                    setattr(stmt, attr, _num(raw))
                elif attr in counts:
                    n = _num(raw)
                    setattr(stmt, attr, int(n) if n is not None else None)
                else:
                    setattr(stmt, attr, str(raw).strip())
            m = re.search(r"From\[([\d/]+)\]\s*To\[([\d/]+)\]", str(cell))
            if m:
                stmt.period_start, stmt.period_end = m.group(1), m.group(2)


SWEEP_MARKERS = (
    "purchase was made with",
    "Internet Purchase Transaction from account",
    "Purchase from account",
)

# The card format states the amount before the verb, the internet format after
# the account number.
STATED_CARD = re.compile(r"^SAR\s*([\d,]+(?:\.\d+)?)\s")
STATED_ONLINE = re.compile(r"account \*+ ?\d+ ([\d,]+(?:\.\d+)?) SAR (?:from|in)")

# The exporter sometimes truncates the Arabic purchase row to the trailing
# digits of the merchant name plus the timestamp.
TRUNCATED = re.compile(r"^(\d+) On \d{2}-\d{2}-\d{4} at")

SWEEP_MERCHANT = re.compile(r"(?:at|from)\s+(.+?)\s+(?:On|in)\s+\d{2}-\d{2}-\d{4}")

PATTERNS = [
    (Kind.CARD_PURCHASE, "تم الشراء", re.compile(r"Card \*(\d+) في (.+?) على \d{2}-\d{2}-\d{4}")),
    (Kind.ONLINE_PURCHASE, "معاملة شراء عبر الإنترنت", re.compile(r"SAR من (.+?) في \d{2}-\d{2}-\d{4}")),
    (Kind.REFUND, "معاملة إعادة الشراء", re.compile(r"SAR من (.+?) في \d{2}-\d{2}-\d{4}")),
]


def stated_amount(desc: str):
    """The purchase amount a sweep row refers to, not the sweep itself."""
    m = STATED_CARD.match(desc) or STATED_ONLINE.search(desc)
    return round(float(m.group(1).replace(",", "")), 2) if m else None


def classify(t: Transaction) -> Transaction:
    d = t.description_raw

    # An English-first row is always the round-up savings sweep; the Arabic row
    # beside it carries the purchase. Verified across all 417 sweep rows: each
    # has an Arabic partner whose debit equals this row's stated amount. Do not
    # compare stated against debit to decide, because a purchase ending in .50
    # sweeps exactly its own value and the comparison misfires.
    if any(marker in d for marker in SWEEP_MARKERS):
        t.kind = Kind.ROUNDUP_SWEEP
        m = SWEEP_MERCHANT.search(d)
        t.merchant_raw = m.group(1) if m else None
        return t

    if TRUNCATED.match(d):
        t.kind = Kind.CARD_PURCHASE
        return t

    for kind, marker, rx in PATTERNS:
        if marker in d:
            t.kind = kind
            m = rx.search(d)
            if m:
                t.merchant_raw = m.group(m.lastindex)
                if kind == Kind.CARD_PURCHASE and m.lastindex == 2:
                    t.card_last4 = m.group(1)
            return t

    if "VISA - عملية شراء" in d or "رقم المرجع ATM" in d:
        t.kind = Kind.INTL_PURCHASE
        # Anchor on the last ' من ' before '__ على'; the first one matches the
        # account prefix and yields the literal text "نقاط البيع من الحساب".
        i = d.find("__ على")
        if i > 0:
            seg = d[:i]
            j = seg.rfind(" من ")
            t.merchant_raw = (seg[j + 4:] if j > 0 else seg).strip()
        fee = re.search(r"([\d.]+) العمولة", d)
        if fee:
            t.fx_fee = float(fee.group(1))
        cur = re.search(r"(USD|EUR|GBP|AED|SAR) ([\d.]+) ID", d)
        if cur:
            t.fx_currency, t.fx_amount = cur.group(1), float(cur.group(2))
        rate = re.search(r"سعر الصرف ([\d.]+)", d)
        if rate:
            t.fx_rate = float(rate.group(1))
        return t

    if "الشراء من الحساب" in d:
        t.kind = Kind.CARD_PURCHASE
        m = re.search(r"SAR من (.+?) (?:في|على) \d{2}-\d{2}-\d{4}", d)
        t.merchant_raw = m.group(1) if m else None
        return t

    if "حوالة داخلية" in d:
        t.kind = Kind.INTERNAL_TRANSFER
        return t

    if "التحويل الوارد سريع" in d:
        t.kind = Kind.EXTERNAL_TRANSFER_IN
        m = re.search(r"المحول (.+?) المبلغ", d)
        t.merchant_raw = m.group(1).strip() if m else None
        return t

    if "حوالة صادرة" in d:
        t.kind = Kind.EXTERNAL_TRANSFER_OUT
        m = re.search(r"\) ([A-Z][A-Za-z ]+?) في مصرف", d) or re.search(r"IBAN:(\w+)\)", d)
        t.merchant_raw = m.group(1).strip() if m else None
        return t

    if "إيداع نقدي" in d:
        t.kind = Kind.CASH_DEPOSIT
        return t

    if "سحب نقدي" in d:
        t.kind = Kind.CASH_WITHDRAWAL
        return t

    if "سداد فاتورة" in d:
        t.kind = Kind.BILL_PAYMENT
        m = re.search(r"سداد فاتورة (.+?) رقمها (\d+)", d)
        if m:
            t.merchant_raw = m.group(1).strip()
            t.biller_account = m.group(2)
        return t

    return t


def parse(path: str) -> Statement:
    rows = _read_grid(path)
    stmt = Statement(source_path=path)
    _header(rows, stmt)
    stmt.bank = bank_from_iban(stmt.iban) or "Alinma"

    for row in rows:
        if not row or not row[0]:
            continue
        serial = _num(row[0])
        if serial is None or serial < MIN_SERIAL:
            continue
        row = list(row) + [""] * (5 - len(row))
        credit = _num(row[2]) or 0.0
        debit = _num(row[3]) or 0.0
        t = Transaction(
            posted_date=(EXCEL_EPOCH + datetime.timedelta(days=serial)).isoformat(),
            description_raw=clean(str(row[1])),
            debit=abs(debit),
            credit=abs(credit),
            balance_after=_num(row[4]),
        )
        stmt.transactions.append(classify(t))

    _recover_truncated(stmt)
    return stmt


def _recover_truncated(stmt: Statement) -> None:
    """Name the truncated purchase rows from the sweep that accompanies them.

    The sweep keeps the full merchant name and states the purchase amount, so
    match on that amount within a day either side of the posting date.
    """
    sweeps = {}
    for t in stmt.transactions:
        if t.kind == Kind.ROUNDUP_SWEEP and t.merchant_raw:
            amount = stated_amount(t.description_raw)
            if amount is not None:
                sweeps.setdefault((t.posted_date, amount), t.merchant_raw)

    for t in stmt.transactions:
        if t.merchant_raw or not TRUNCATED.match(t.description_raw):
            continue
        day = datetime.date.fromisoformat(t.posted_date)
        for offset in (0, -1, 1):
            key = ((day + datetime.timedelta(days=offset)).isoformat(), round(t.debit, 2))
            if key in sweeps:
                t.merchant_raw = sweeps[key]
                break





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
