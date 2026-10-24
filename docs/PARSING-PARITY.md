# Alinma parsing parity: Go against the Python reference

Reference from commit e2ecaa3 (`parsers/reference/`), run from a temp directory.
Both XLSX files in `statements/` share sha256 4d0a3174, so the runs are repeats.

## Commands
```
go run ./cmd/statement statements/<file>.xlsx --json=<tmp>/go-<file>.json
cd <tmp>/ref && python3 alinma_xlsx.py statements/<file>.xlsx --json <tmp>/py-<file>.json
```

Go amounts are integer halalas; Python floats convert with round(value * 100)
and compare by exact integer equality, no tolerance. Per row: posted_date,
debit, credit, balance_after, kind. A planted one-row mismatch was caught, so
the comparison is not vacuous.

## Per file
| File | Rows Go | Rows Python | Matching | Differing | Exit Go | Exit Python |
|---|---|---|---|---|---|---|
| statements/ file 1 | 1368 | 1368 | 1368 | 0 | 0 | 0 |
| statements/ file 2 | 1368 | 1368 | 1368 | 0 | 0 | 0 |

The six header figures match for both files. Reconciliation agrees: ok=true,
all five checks pass in both.

## Differences
None in the compared fields. Outside them fx_rate is a string in Go and a float
in Python, same rows (23 per file), numerically equal: the intended type change.

ALINMA PARITY: PASS
