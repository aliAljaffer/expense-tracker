"""Shared record shape and reconciliation for Alinma statement parsers."""

from dataclasses import dataclass, field, asdict
from typing import Optional


class Kind:
    CARD_PURCHASE = "card_purchase"
    ONLINE_PURCHASE = "online_purchase"
    INTL_PURCHASE = "intl_purchase"
    REFUND = "refund"
    ROUNDUP_SWEEP = "roundup_sweep"
    INTERNAL_TRANSFER = "internal_transfer"
    EXTERNAL_TRANSFER_IN = "external_transfer_in"
    EXTERNAL_TRANSFER_OUT = "external_transfer_out"
    SALARY = "salary"
    CASH_DEPOSIT = "cash_deposit"
    CASH_WITHDRAWAL = "cash_withdrawal"
    BILL_PAYMENT = "bill_payment"
    CARD_PAYMENT = "card_payment"
    FEE = "fee"
    UNKNOWN = "unknown"


SPENDING_KINDS = frozenset({
    Kind.CARD_PURCHASE,
    Kind.ONLINE_PURCHASE,
    Kind.INTL_PURCHASE,
    Kind.BILL_PAYMENT,
    Kind.CASH_WITHDRAWAL,
    Kind.FEE,
})


# Bank names in a statement body are unreliable: an inward transfer quotes the
# SENDING bank's BIC, so an Al Rajhi statement can mention Alinma sixteen times.
# The two digits after the IBAN check digits are authoritative.
SA_BANK_CODES = {
    "05": "Alinma",
    "10": "Saudi National Bank",
    "15": "Banque Saudi Fransi",
    "20": "Riyad Bank",
    "30": "Arab National Bank",
    "45": "Saudi Investment Bank",
    "55": "Bank Albilad",
    "60": "Bank Aljazira",
    "80": "Al Rajhi",
}


def bank_from_iban(iban: Optional[str]) -> Optional[str]:
    if not iban:
        return None
    clean = iban.replace(" ", "").upper()
    if not clean.startswith("SA") or len(clean) < 6:
        return None
    return SA_BANK_CODES.get(clean[4:6])


@dataclass
class Transaction:
    posted_date: str
    description_raw: str
    debit: float = 0.0
    credit: float = 0.0
    balance_after: Optional[float] = None
    kind: str = Kind.UNKNOWN
    merchant_raw: Optional[str] = None
    value_date: Optional[str] = None
    fx_currency: Optional[str] = None
    fx_amount: Optional[float] = None
    fx_rate: Optional[float] = None
    fx_fee: Optional[float] = None
    biller_code: Optional[str] = None
    biller_account: Optional[str] = None
    card_last4: Optional[str] = None

    @property
    def counts_as_spending(self) -> bool:
        return self.kind in SPENDING_KINDS and self.debit > 0

    def to_dict(self) -> dict:
        d = asdict(self)
        d["counts_as_spending"] = self.counts_as_spending
        return d


@dataclass
class Statement:
    source_path: str
    account_number: Optional[str] = None
    iban: Optional[str] = None
    bank: Optional[str] = None
    customer_name: Optional[str] = None
    currency: str = "SAR"
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    opening_balance: Optional[float] = None
    closing_balance: Optional[float] = None
    stated_debit_total: Optional[float] = None
    stated_credit_total: Optional[float] = None
    stated_debit_count: Optional[int] = None
    stated_credit_count: Optional[int] = None
    transactions: list = field(default_factory=list)

    def reconcile(self, tolerance: float = 0.01) -> dict:
        """Check the parse against the six figures in the statement header.

        A short parse is silent otherwise, so callers should refuse an import
        whose result is not ok.
        """
        debits = [t for t in self.transactions if t.debit > 0]
        credits = [t for t in self.transactions if t.credit > 0]
        parsed = {
            "debit_total": round(sum(t.debit for t in debits), 2),
            "credit_total": round(sum(t.credit for t in credits), 2),
            "debit_count": len(debits),
            "credit_count": len(credits),
        }
        stated = {
            "debit_total": abs(self.stated_debit_total) if self.stated_debit_total is not None else None,
            "credit_total": self.stated_credit_total,
            "debit_count": self.stated_debit_count,
            "credit_count": self.stated_credit_count,
        }
        checks = {}
        for key, got in parsed.items():
            want = stated[key]
            if want is None:
                checks[key] = None
            elif isinstance(want, int):
                checks[key] = got == want
            else:
                checks[key] = abs(got - want) <= tolerance

        if self.opening_balance is not None and self.closing_balance is not None:
            implied = self.opening_balance + parsed["credit_total"] - parsed["debit_total"]
            checks["balance_walk"] = abs(implied - self.closing_balance) <= tolerance
        else:
            checks["balance_walk"] = None

        return {
            "ok": all(v for v in checks.values() if v is not None),
            "checks": checks,
            "parsed": parsed,
            "stated": stated,
        }


def print_report(stmt: Statement) -> bool:
    r = stmt.reconcile()
    print(f"source        {stmt.source_path}")
    print(f"bank          {stmt.bank or 'unknown'}")
    print(f"account       {stmt.account_number}")
    print(f"period        {stmt.period_start} .. {stmt.period_end}")
    print(f"balance       {stmt.opening_balance} -> {stmt.closing_balance}")
    print(f"transactions  {len(stmt.transactions)}")
    print("reconciliation")
    for key, ok in r["checks"].items():
        mark = "skip" if ok is None else ("pass" if ok else "FAIL")
        got = r["parsed"].get(key)
        want = r["stated"].get(key)
        detail = "" if got is None else f"  parsed={got} stated={want}"
        print(f"  {mark:5} {key}{detail}")
    print("RESULT        " + ("ok" if r["ok"] else "REJECT"))
    return r["ok"]
