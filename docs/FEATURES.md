# Features

Ordered by how much pain they remove. Tier 1 is the minimum product that beats
a spreadsheet.

Figures are illustrative and rounded. Each feature traces to a problem observed
while reconciling real statements by hand.

---

## Tier 1: correctness

Without these the numbers are wrong, and wrong numbers are worse than none.

### 1. Import reconciliation

Every statement header carries opening balance, closing balance, deposit count,
withdrawal count, total deposits and total withdrawals. Check the parse against
all six. Refuse the import if any fails.

This is the single most valuable feature. A first-pass PDF parser captured
about two thirds of the rows and the totals were short by thousands of riyals.
The header check caught it immediately. Without the check the error is invisible.

Show the user the reconciliation result on every import.

### 2. Duplicate file detection

Hash the file on upload. Reject exact duplicates.

The two XLSX files supplied were byte-identical, same MD5, different filenames.
Importing both would have doubled every figure.

### 3. Transfer netting across accounts

Money moving between the user's own accounts is not income and not spending.
Detect and exclude it.

**The amounts will not match.** A cross-bank transfer arrives smaller than it
left, because the fee comes off in flight:

| Date | Alinma out | Al Rajhi in | Fee |
|---|---|---|---|
| 2026-03-14 | 3,001.15 | 3,000.00 | 1.15 |
| 2026-04-02 | 1,645.15 | 1,644.00 | 1.15 |

Match on direction, a date window of two days, and an amount tolerance of a few
riyals. Book the difference as a fee. Exact-amount matching silently misses
every cross-bank pair, which is the case netting exists for.

Same-bank internal transfers are a separate thing and must not be paired across
banks. Each bank reports its own internal transfers, in the thousands, and the
two figures have nothing to do with each other.

Let the user confirm matches the system is unsure about, and remember the
decision.

### 4. Synthetic row suppression

Banks emit rows that are not purchases. Classify them, do not count them as
spending, but do not discard them either.

Alinma emits a round-up savings sweep as a separate debit beside every card
purchase. In the sample this was several hundred rows worth over a thousand
riyals. A naive importer counts them as spending and also double counts each
purchase.

Treat them as a transfer to savings, shown separately.

### 5. Credit card blind spot warning

Account statements show card payments leaving the account. They never show what
the card was spent on.

In the sample, more than ten thousand riyals of card payments were visible, but
the underlying purchases were invisible. Any category breakdown built from the
account alone silently omits them.

Detect card payment rows. Warn the user that a linked card statement is needed,
and name the card. Show coverage as a percentage of total outflow.

---

## Tier 2: the analysis the user actually wants

### 6. Recurring payment detection

Flag a merchant as recurring when it appears in three or more distinct calendar
months. Report count, distinct months, total, median amount and date range.

Median beats mean here. One merchant had a median far below its mean, because a
single large charge pulled the mean up.

Distinguish three kinds, because the advice differs:

| Kind | Example from the data | Action |
|---|---|---|
| Contractual | Rent, monthly, via Sadad | Renegotiate or leave |
| Subscription | A streaming plan, recurring across many months | Cancel or keep |
| Habit | A cafe, dozens of visits, small median | Behavior change |

The third kind is the one spreadsheets miss and it is often the largest.

### 7. Sadad biller identity

Sadad payments carry a stable biller code and account number. Use them as the
merchant key, not the free-text description.

Observed: one biller code belongs to a rent service, another to a mobile
operator. The code and account are reliable across months when the text is not.

### 8. Merchant normalization

Raw strings fragment badly. The same grocery store appeared under three
variants of its name, splitting dozens of visits across them and hiding the real
total.

Suggested approach:
1. Strip trailing city and country (`, RIYADH, SA`).
2. Strip branch numbers and store codes.
3. Collapse whitespace, uppercase.
4. Fuzzy match the remainder against known merchants.
5. Let the user merge two merchants manually, and remember it.

Never auto merge without showing the user. A wrong merge is hard to notice later.

### 9. Shared expense splitting

One person pays a bill, the other reimburses. Track the user's real share.

In the sample, rent and internet were split with a roommate who transferred half
back each month. Counting the full amount made housing look like nearly half of
net salary. The true figure was about a quarter. That error pointed the entire
recommendation at the wrong problem.

Required behavior:
- Mark an expense as shared, with a split ratio.
- Match incoming reimbursements to the shared expense.
- Report both gross paid and net personal cost.
- Flag a shared expense that was never reimbursed.

### 10. BNPL tracking

Buy now pay later needs its own treatment. Installments look like small
purchases but they are debt with a schedule.

The escalation in the sample was only visible once the charges were put in
order:

| Date | Amount |
|---|---|
| Jan to May 2026 | 40 monthly |
| 27 Jul 2026 | 500 |
| 25 Aug 2026 | 900 |
| 24 Sep 2026 | 1,800 |

Features:
- Group installments into plans.
- Project the remaining schedule.
- Alert when the monthly total rises for three consecutive months, which means
  new plans are being opened faster than old ones close.
- Show BNPL as a percentage of monthly income. In the sample it passed twenty
  percent.

### 11. Category rules the user owns

Ship starter rules, let the user override, and apply overrides retroactively.

Keep an explicit `Uncategorised` bucket and show its size. In the sample it held
roughly a tenth of spending, which is the honest number. Hiding it in `Other`
would have been misleading.

### 12. Income stability view

Separate salary from everything else. Show the trend.

Net salary in the sample rose by more than eighty percent in a single year. Any
budget built on the earlier figure was stale within a month.

Detect payroll by a stable sender plus a monthly cadence.

---

## Tier 3: behavior change

### 13. Micro-transaction report

Several hundred card purchases over eleven months, a median under 25 SAR, a few
a day. About half were under 25 SAR and together came to thousands of riyals.

No single charge is worth reviewing. The aggregate is. Show count, total, and
the top merchants by frequency rather than by value.

### 14. Buffer and runway

Show days of expenses held in cash, not just the balance.

Both accounts in the sample were drained repeatedly, one closing under twenty
riyals and the other touching single digits. Balance alone does not communicate
this. Runway does.

### 15. Debt payoff planner

Inputs: balance, limit, APR, promotional rate and its expiry date.

The user in the sample was carrying most of an 8,000 limit at a 0 percent
introductory APR and could not state the expiry date from any statement. That
date decides whether patience is free or expensive.

Features:
- Require the promo expiry date. Warn loudly when it is unknown.
- Flag deferred interest separately from true 0 percent. They behave very
  differently at expiry.
- Show credit utilization. Being close to the limit affects a SIMAH score
  regardless of APR.
- Project a payoff date from observed monthly surplus.

### 16. Foreign currency cost

Show the markup separately from the purchase.

International Visa purchases in the sample carried a few percent in markup
across dozens of transactions, and it never appears as its own line, so it is
never questioned.

Alinma puts the original currency, the amount, the exchange rate and the
commission in the description. Parse all four.

---

## Deliberately not recommended

**Automatic budget enforcement and spending locks.** The data shows the problem
is not awareness of individual purchases. It is that intake (new BNPL plans)
outpaces payoff. A lock on card spending does not touch that.

**Aggressive subscription cancellation prompts.** Total digital subscriptions in
the sample, excluding one professional certification, came to about a hundred
riyals a month. Subscription cancellation is the most common feature in this
category of app and it would have saved this user almost nothing. Report the
number, then stay quiet about it.

**Receipt scanning via OCR.** High effort, and the statement already carries the
merchant and amount. Add it only if line-item detail inside a single receipt
turns out to matter.
