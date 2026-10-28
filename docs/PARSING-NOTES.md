# Statement parsing notes

Observed while parsing two sample statements to an exact reconciliation. Every
example below is synthetic and keeps the real layout.

Two banks, two formats, nothing shared between them.

| Bank | Format |
|---|---|
| Alinma | XLSX |
| Al Rajhi | PDF |

## Identify the bank from the IBAN, not the body text

Body text mentions other banks constantly. An Al Rajhi statement quotes the BIC
of the bank that sent each inward transfer, so it can contain the string `INMA`
more often than its own name. ATM terminal IDs add more noise.

Take the two digits after the check digits in the account's own IBAN.

| Code | Bank |
|---|---|
| 05 | Alinma |
| 80 | Al Rajhi |

`SA00` **`80`** `123456789012345678` is Al Rajhi.

## Alinma XLSX export

Structure: seven header rows of metadata, then a column header row, then
transactions. Columns are date, description, credit, debit, balance.

### Dates are Excel serials

Epoch is 1899-12-30. Serial `45966` is 2025-11-05. A fractional serial carries
a time, which the parser keeps; the observed export uses whole-day serials.

A trailing row carries the closing balance in the date column (`25.00`). Reject
any serial below roughly 40000.

### Every card purchase produces two rows

Row A, English text first, carries the round-up savings sweep.
Row B, Arabic only, carries the real purchase amount.

Example, a 25.75 SAR purchase:

```
Row A  "SAR 25.75 purchase was made with Apple Pay App by Mada Card *0630
        at SAMPLE CO On 05-11-2025 ..."              debit -4.25
Row B  "SAR 25.75 تم الشراء مع Apple Pay App بواسطة Mada Card *0630
        في SAMPLE CO على 05-11-2025 ..."             debit -25.75
```

The sweep rounds up to the next multiple of 5. 25.75 sweeps 4.25. 30.42 sweeps
4.58. 89.00 sweeps 1.00.

Reliable test: parse the `SAR <amount>` prefix and compare it to the debit. On
the Arabic row they match on every row tested. On the English row they almost
never do.

Not every purchase has a sweep. Do not assume pairs.

### Line wrapping injects `#`

The exporter marks wrapped lines with `#` inside the description, sometimes mid
word.

```
"في SAMPLE STORE   #TRAD على 06-11-2025"
```

Replace `#` with a space and collapse whitespace before matching. Do it before
any merchant regex, or `SAMPLE STORE TRAD` fragments.

### Transaction type prefixes

| Arabic prefix | Meaning |
|---|---|
| `تم الشراء` | Card purchase, real amount |
| `معاملة شراء عبر الإنترنت` | Online purchase |
| `معاملة إعادة الشراء` | Refund, appears as a credit |
| `رقم المرجع ATM...VISA` | International Visa purchase |
| `حوالة داخلية` | Internal transfer, same bank |
| `التحويل الوارد سريع` | Incoming IPS transfer |
| `حوالة صادرة` | Outgoing transfer |
| `إيداع نقدي` | ATM cash deposit |
| `سحب نقدي` | ATM cash withdrawal |
| `سداد فاتورة` | Sadad bill payment |

### International purchase rows

One row holds the SAR amount, the original currency and amount, the exchange
rate and the commission.

```
... for SAR 1001.25 من SAMPLE__ على 19-11-2025 ...
SAMPLE LLC,USD 267.00 ID55000001 ... سعر الصرف 3.75
USD #267 25.03 العمولة
```

The merchant sits between the last ` من ` and `__ على`. Anchoring on the first
` من ` matches the account prefix instead and returns the literal account
prefix, which is what a first attempt did.

Commission is the number immediately before `العمولة`.

## Al Rajhi PDF export

Text is extracted in Go from glyph positions, which reproduces `pdftotext
-layout`: glyphs are grouped by baseline and the gaps between them become
spaces. Without layout the columns interleave.

### Rows span multiple lines and the amount line varies

The amount triple (`debit SAR  credit SAR  balance SAR`) sometimes sits on the
date line and sometimes one to four lines below it. The merchant often continues
on the line after the amounts.

A date-line-driven parser captured about two thirds of the sample rows. An
amount-line-driven parser that walks backwards to the nearest date, then to the
nearest known transaction type, captured all of them and reconciled exactly.

Parse in this order:
1. Find lines ending in the amount triple.
2. Walk back up to 8 lines for a date in `YYYY/MM/DD`.
3. Walk back up to 4 more lines for a known transaction type string.
4. Read the merchant from the date line plus up to 2 following lines.
5. Read the posting time from `Time:HH:MM:SS` on the date line.
6. Deduplicate on date, time, debit, credit and balance.

### Transaction type strings

```
POS purchase Apple pay (Domestic)
POS purchase Apple pay (International)
Online purchase Apple pay (Domestic)
Online purchase Apple pay (International)
POS purchase Atheer (Domestic)
Internal Transfer
Inward IPS Credit Transfer
Outward IPS Credit Transfer
Outward IPS Credit Transaction Charges
Debit - Credit Cards Transactions
Sadad Payments
Visa Payment
Credit Salary
ATM Deposit
Dynamic Currencies Debit Card Markup
Kiosk - ATM Card Renewal Fees
Message to beneficiary
```

### POS note format

```
Notes:(1234567890123456-123456789012) SAMPLE STORE
      ANY CITY, SA
```

The leading parenthesized pair is a terminal and reference identifier, not part
of the merchant. Strip `(\d+-\d+)` then strip the trailing `, CITY, SA`.

### Sadad note format

```
Notes:W#153-4000000001 -10000000001  500.00 SAR
```

`153` is the biller code, `10000000001` is the user's account with that biller.
Both are stable. The middle number changes per payment.

### Outgoing IPS transfers carry a separate fee row

Each `Outward IPS Credit Transfer` is followed by an
`Outward IPS Credit Transaction Charges` row of 0.58 SAR (0.50 plus VAT). Count
it as a fee, not as a transfer.

## General

### Reconcile before trusting anything

Both statements expose opening balance, closing balance, counts and totals.
Assert all of them. Both parsers match to the cent.

A parser that drops rows still produces plausible output. Only the header
figures show the gap.

### Cross-bank self-transfers lose the fee

A transfer from Alinma to Al Rajhi arrives smaller than it left. Match on the
date and a tolerance, never on an exact amount.

| Date | Alinma out | Al Rajhi in | Fee |
|---|---|---|---|
| 2026-06-24 | 5,001.15 | 5,000.00 | 1.15 |
| 2026-08-28 | 2,645.15 | 2,644.00 | 1.15 |

Each bank also has its own same-bank internal transfers. Those are unrelated to
each other. Do not pair them.

### Arabic text direction

Descriptions mix Arabic and Latin in one field. Store as UTF-8 and do not
normalize direction. Match on Latin substrings where possible, because they are
more stable than the Arabic, which contains presentation forms in the PDF.

## Go PDF text extraction

`github.com/ledongthuc/pdf` `v0.0.0-20261020125853-5e46805f718e`, a pseudo-version:
never tagged, last commit 2026-10-20. Verdict: keep. Pure Go, already in `go.mod`,
and it reproduced every figure the reconciliation depends on.

Measured on one 13-page statement against `pdftotext -layout`:

- 330 of 330 rows recovered, same date, debit, credit and balance keys.
- All 9 header figures recovered, values identical to pdftotext.
- 330 of 330 transaction type strings matched, so classification is unchanged.
- 0 of 330 descriptions matched byte for byte, though every Latin token was
  present. The type label lands on the date line where pdftotext gives it its own
  line, so group rows by glyph X and Y; the 2-line tail rule does not port.
- 24 rows carry Arabic. Characters survive, order and spacing do not.
- 34353 of 47979 glyph runs report width 0: use `Page.Content().Text` and its X and
  Y, never `GetPlainText` or `GetTextByRow`. Spacing here relies on drawn spaces.

The port uses glyph row grouping and asserts the same five reconciliation checks.
24 open issues, 7 on text extraction, none blocking.
