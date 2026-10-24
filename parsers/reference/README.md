# Reference parsers (Python)

The original parsers, kept only while the Go port is verified against them.
Delete this directory once the Go output matches on every documented case.

Both produce the same `Transaction` record and both refuse to pass a statement
that does not reconcile against its own header.

One parser per bank, because the formats share nothing.

| Bank | Export format |
|---|---|
| Alinma | XLSX |
| Al Rajhi | PDF |

## Requirements

- Python 3.9 or newer. Standard library only.
- `pdftotext` from poppler, for the PDF parser (`brew install poppler`).

The XLSX parser reads the workbook with `zipfile` and `ElementTree`, so no
spreadsheet package is required.

## Usage

```
python3 alinma_xlsx.py path/to/statement.xlsx
python3 alrajhi_pdf.py path/to/statement.pdf
```

Add `--json out.json` to write normalized transactions.

Exit code is 0 when the statement reconciles and 1 when it does not.

```python
from alinma_xlsx import parse

stmt = parse(path)
if not stmt.reconcile()["ok"]:
    raise ValueError("refusing a statement that does not balance")
spending = sum(t.debit for t in stmt.transactions if t.counts_as_spending)
```

## Files

| File | Purpose |
|---|---|
| `common.py` | `Transaction`, `Statement`, `Kind`, reconciliation |
| `alinma_xlsx.py` | Alinma, Brief Statement of Account |
| `alrajhi_pdf.py` | Al Rajhi, Account Statement |

## Verified output

Both parsers match all six header figures on the local sample statements. The
real figures stay on the machine that holds the statements.

Spending figures from the two accounts overlap in time and include transfers
between the user's own accounts, so do not add them. Netting is the importer's
job, not the parser's.

## Identify the bank from the IBAN

Bank names in the body are unreliable. A statement can mention another bank more
often than its own, because it quotes the BIC of each sender. Use the two digits
after the check digits in the account's own IBAN.

| Code | Bank |
|---|---|
| 05 | Alinma |
| 80 | Al Rajhi |

`SA00` **`80`** `123456789012345678` is Al Rajhi.

## Three decisions worth keeping

**The English row is always the round-up sweep.** Do not decide by comparing
the stated amount to the debit. A purchase ending in .50 sweeps exactly its own
value, so the comparison misfires. Every sweep row checked had an Arabic partner
carrying the real amount.

**Truncated rows are recovered by pairing, not by guessing.** The exporter
sometimes cuts the Arabic purchase row down to trailing digits and a timestamp
(`505 On 08-01-2026 at 08:27AM`). The accompanying sweep keeps the full merchant
name, so match on the stated amount within a day either side. One row in the
sample still fails to pair. It stays unnamed rather than guessed.

**Unparsed rows keep their amounts.** Some credits carry a description that is
only digits. They stay as `unknown` with the correct amount so the statement
still balances. Dropping a row you cannot classify breaks reconciliation and
hides the gap.

## Not handled

- Credit card statements. Different format, and no sample was available.
- Multi-currency accounts. Both samples were SAR only.
- Statements where the opening balance is absent.
