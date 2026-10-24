// Package ledger holds the read queries behind the account and overview
// views. It returns masked numbers only and never exposes an IBAN.
package ledger

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	// database/sql driver for the connection in Open.
	_ "github.com/jackc/pgx/v5/stdlib"
)

var ErrBadFilter = errors.New("invalid filter")

const (
	defaultLimit = 100
	maxLimit     = 500
)

type Store struct {
	db *sql.DB
}

func Open(ctx context.Context, url string) (*Store, error) {
	db, err := sql.Open("pgx", url)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	if err := db.PingContext(ctx); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping database: %w", err)
	}
	return &Store{db: db}, nil
}

func (s *Store) Close() error { return s.db.Close() }

// MaskNumber keeps the last four characters and hides the rest.
func MaskNumber(number string) string {
	n := len(number)
	if n <= 4 {
		return number
	}
	return strings.Repeat("*", n-4) + number[n-4:]
}

type Account struct {
	ID          int64   `json:"id"`
	Bank        string  `json:"bank"`
	Number      *string `json:"masked_number"`
	Kind        string  `json:"kind"`
	Currency    string  `json:"currency"`
	Balance     *int64  `json:"balance"`
	BalanceDate *string `json:"balance_date"`
}

// Accounts lists every account with the balance the UI shows: the
// balance_after of the newest transaction by the statement order.
func (s *Store) Accounts(ctx context.Context) ([]Account, error) {
	rows, err := s.db.QueryContext(ctx, `
		select a.id, a.bank, coalesce(a.number, '') as number, a.kind, a.currency,
		       latest.balance_after, latest.posted_date::text
		from account a
		left join lateral (
			select t.balance_after, t.posted_date
			from transaction t
			where t.account_id = a.id
			order by t.posted_date desc, t.posted_time desc, t.id desc
			limit 1
		) latest on true
		order by a.id`)
	if err != nil {
		return nil, fmt.Errorf("read accounts: %w", err)
	}
	defer rows.Close()
	var out []Account
	for rows.Next() {
		var a Account
		var raw string
		if err := rows.Scan(&a.ID, &a.Bank, &raw, &a.Kind, &a.Currency,
			&a.Balance, &a.BalanceDate); err != nil {
			return nil, fmt.Errorf("read account row: %w", err)
		}
		if raw != "" {
			masked := MaskNumber(raw)
			a.Number = &masked
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

type Income struct {
	Salary      int64 `json:"salary"`
	TransfersIn int64 `json:"transfers_in"`
	Refunds     int64 `json:"refunds"`
	Other       int64 `json:"other"`
	Total       int64 `json:"total"`
}

type Spending struct {
	CardPurchase   int64 `json:"card_purchase"`
	OnlinePurchase int64 `json:"online_purchase"`
	IntlPurchase   int64 `json:"intl_purchase"`
	BillPayment    int64 `json:"bill_payment"`
	CashWithdrawal int64 `json:"cash_withdrawal"`
	Fee            int64 `json:"fee"`
	Total          int64 `json:"total"`
}

type Transfers struct {
	Internal      int64 `json:"internal"`
	ExternalOut   int64 `json:"external_out"`
	RoundupSweeps int64 `json:"roundup_sweeps"`
	Total         int64 `json:"total"`
}

type Coverage struct {
	CardPayments      int64   `json:"card_payments"`
	PurchasesRecorded int64   `json:"purchases_recorded"`
	Uncovered         int64   `json:"uncovered"`
	UncoveredShare    float64 `json:"uncovered_share"`
}

type Month struct {
	Month                 string    `json:"month"`
	Income                Income    `json:"income"`
	Spending              Spending  `json:"spending"`
	Transfers             Transfers `json:"transfers"`
	CardPayments          int64     `json:"card_payments"`
	UncategorisedSpending int64     `json:"uncategorised_spending"`
	OutflowTotal          int64     `json:"outflow_total"`
	CreditCardCoverage    Coverage  `json:"credit_card_coverage"`
	TransactionCount      int64     `json:"transaction_count"`
}

// Monthly aggregates the months from fromMonth to toMonth inclusive, oldest
// first. Every debit or credit of a month lands in exactly one field, and each
// field matches the transaction rows the corresponding bucket in Transactions
// selects, so drill-down sums always equal the stored total.
func (s *Store) Monthly(ctx context.Context, fromMonth, toMonth string) ([]Month, error) {
	from, err := time.Parse("2006-01", fromMonth)
	if err != nil {
		return nil, fmt.Errorf("%w: from must be YYYY-MM", ErrBadFilter)
	}
	to, err := time.Parse("2006-01", toMonth)
	if err != nil {
		return nil, fmt.Errorf("%w: to must be YYYY-MM", ErrBadFilter)
	}
	if from.After(to) {
		return nil, fmt.Errorf("%w: from month is after to month", ErrBadFilter)
	}
	first := from.Format("2006-01-02")
	last := time.Date(to.Year(), to.Month(), 1, 0, 0, 0, 0, time.UTC).
		AddDate(0, 1, 0).AddDate(0, 0, -1).Format("2006-01-02")

	rows, err := s.db.QueryContext(ctx, `
		select
			to_char(posted_date, 'YYYY-MM'),
			count(*),
			coalesce(sum(debit), 0),
			coalesce(sum(credit), 0),
			coalesce(sum(credit) filter (where kind = 'salary'), 0),
			coalesce(sum(credit) filter (where kind = 'external_transfer_in'), 0),
			coalesce(sum(credit) filter (where kind = 'refund'), 0),
			coalesce(sum(debit) filter (where counts_as_spending and debit > 0), 0),
			coalesce(sum(debit) filter (where counts_as_spending and debit > 0 and kind = 'card_purchase'), 0),
			coalesce(sum(debit) filter (where counts_as_spending and debit > 0 and kind = 'online_purchase'), 0),
			coalesce(sum(debit) filter (where counts_as_spending and debit > 0 and kind = 'intl_purchase'), 0),
			coalesce(sum(debit) filter (where counts_as_spending and debit > 0 and kind = 'bill_payment'), 0),
			coalesce(sum(debit) filter (where counts_as_spending and debit > 0 and kind = 'cash_withdrawal'), 0),
			coalesce(sum(debit) filter (where counts_as_spending and debit > 0 and kind = 'fee'), 0),
			coalesce(sum(debit) filter (where kind = 'internal_transfer' and debit > 0), 0),
			coalesce(sum(debit) filter (where kind = 'external_transfer_out' and debit > 0), 0),
			coalesce(sum(debit) filter (where kind = 'roundup_sweep' and debit > 0), 0),
			coalesce(sum(debit) filter (where kind = 'card_payment' and debit > 0), 0),
			coalesce(sum(debit) filter (where counts_as_spending and debit > 0 and category_id is null), 0),
			coalesce(sum(debit) filter (where kind in ('card_purchase', 'online_purchase', 'intl_purchase') and debit > 0), 0)
		from transaction
		where posted_date >= $1 and posted_date <= $2
		group by 1
		order by 1`, first, last)
	if err != nil {
		return nil, fmt.Errorf("read monthly overview: %w", err)
	}
	defer rows.Close()
	var out []Month
	for rows.Next() {
		var m Month
		var creditTotal, salary, transfersIn, refunds int64
		var internal, externalOut, sweeps, purchases int64
		if err := rows.Scan(&m.Month, &m.TransactionCount, &m.OutflowTotal,
			&creditTotal, &salary, &transfersIn, &refunds,
			&m.Spending.Total, &m.Spending.CardPurchase, &m.Spending.OnlinePurchase,
			&m.Spending.IntlPurchase, &m.Spending.BillPayment, &m.Spending.CashWithdrawal,
			&m.Spending.Fee, &internal, &externalOut, &sweeps,
			&m.CardPayments, &m.UncategorisedSpending, &purchases); err != nil {
			return nil, fmt.Errorf("read monthly row: %w", err)
		}
		m.Income = Income{Salary: salary, TransfersIn: transfersIn, Refunds: refunds,
			Other: creditTotal - salary - transfersIn - refunds, Total: creditTotal}
		m.Transfers = Transfers{Internal: internal, ExternalOut: externalOut,
			RoundupSweeps: sweeps, Total: internal + externalOut + sweeps}
		uncovered := m.CardPayments - purchases
		if uncovered < 0 {
			uncovered = 0
		}
		share := 0.0
		if m.CardPayments > 0 {
			share = math.Round(float64(uncovered)/float64(m.CardPayments)*1e6) / 1e6
		}
		m.CreditCardCoverage = Coverage{CardPayments: m.CardPayments,
			PurchasesRecorded: purchases, Uncovered: uncovered, UncoveredShare: share}
		out = append(out, m)
	}
	return out, rows.Err()
}

type TransactionRow struct {
	ID               int64   `json:"id"`
	AccountID        int64   `json:"account_id"`
	PostedDate       string  `json:"posted_date"`
	PostedTime       string  `json:"posted_time"`
	Description      string  `json:"description"`
	Debit            int64   `json:"debit"`
	Credit           int64   `json:"credit"`
	BalanceAfter     *int64  `json:"balance_after"`
	Kind             string  `json:"kind"`
	CountsAsSpending bool    `json:"counts_as_spending"`
	MerchantID       *int64  `json:"merchant_id"`
	MerchantName     *string `json:"merchant_name"`
	CategoryID       *int64  `json:"category_id"`
	CategoryName     *string `json:"category_name"`
	FxCurrency       *string `json:"fx_currency"`
	FxAmount         *int64  `json:"fx_amount"`
}

type TransactionResult struct {
	Rows        []TransactionRow `json:"rows"`
	TotalCount  int64            `json:"total_count"`
	TotalDebit  int64            `json:"total_debit"`
	TotalCredit int64            `json:"total_credit"`
}

type TransactionFilter struct {
	From, To   string
	AccountID  int64
	MerchantID int64
	Bucket     string
	Kind       string
	Limit      int
	Offset     int
}

var transactionKinds = map[string]bool{
	"card_purchase": true, "online_purchase": true, "intl_purchase": true,
	"refund": true, "roundup_sweep": true, "internal_transfer": true,
	"external_transfer_in": true, "external_transfer_out": true, "salary": true,
	"cash_deposit": true, "cash_withdrawal": true, "bill_payment": true,
	"card_payment": true, "fee": true, "unknown": true,
}

// bucketFilter ties each bucket to the one monthly total it explains, so drill
// down sums always match Month: all adds no filter, income -> income.Total,
// spending -> spending.Total, transfers -> transfers.Total, card_payments ->
// card_payments and credit_card_coverage.card_payments, uncategorised ->
// uncategorised_spending, refunds -> income.refunds.
// The spending and card_payment sums behind the coverage fields use the same
// generated columns and kinds as the filters here.
var bucketFilter = map[string]string{
	"all":           "",
	"income":        "credit > 0",
	"spending":      "counts_as_spending and debit > 0",
	"transfers":     "kind in ('internal_transfer', 'external_transfer_out', 'roundup_sweep') and debit > 0",
	"card_payments": "kind = 'card_payment' and debit > 0",
	"uncategorised": "counts_as_spending and debit > 0 and category_id is null",
	"refunds":       "kind = 'refund' and credit > 0",
}

func (f *TransactionFilter) normalize() error {
	if f.From != "" {
		d, err := time.Parse("2006-01-02", f.From)
		if err != nil {
			return fmt.Errorf("%w: from must be YYYY-MM-DD", ErrBadFilter)
		}
		f.From = d.Format("2006-01-02")
	}
	if f.To != "" {
		d, err := time.Parse("2006-01-02", f.To)
		if err != nil {
			return fmt.Errorf("%w: to must be YYYY-MM-DD", ErrBadFilter)
		}
		f.To = d.Format("2006-01-02")
	}
	if f.From != "" && f.To != "" && f.From > f.To {
		return fmt.Errorf("%w: from date is after to date", ErrBadFilter)
	}
	if f.Bucket == "" {
		f.Bucket = "all"
	}
	if _, ok := bucketFilter[f.Bucket]; !ok {
		return fmt.Errorf("%w: unknown bucket %q", ErrBadFilter, f.Bucket)
	}
	if f.Kind != "" && !transactionKinds[f.Kind] {
		return fmt.Errorf("%w: unknown kind %q", ErrBadFilter, f.Kind)
	}
	if f.Limit == 0 {
		f.Limit = defaultLimit
	}
	if f.Limit < 0 || f.Limit > maxLimit {
		return fmt.Errorf("%w: limit must be between 1 and %d", ErrBadFilter, maxLimit)
	}
	if f.Offset < 0 {
		return fmt.Errorf("%w: offset must not be negative", ErrBadFilter)
	}
	return nil
}

// Transactions returns one page and the totals over the whole filtered set.
// The totals use the same where clause as the page, so total_count and the
// money sums never disagree with the locked filter the URL selected.
func (s *Store) Transactions(ctx context.Context, f TransactionFilter) (TransactionResult, error) {
	var out TransactionResult
	if err := f.normalize(); err != nil {
		return out, err
	}
	var conds []string
	var args []any
	add := func(v any, cond string) {
		args = append(args, v)
		conds = append(conds, fmt.Sprintf(cond, len(args)))
	}
	if f.From != "" {
		add(f.From, "posted_date >= $%d")
	}
	if f.To != "" {
		add(f.To, "posted_date <= $%d")
	}
	if f.AccountID != 0 {
		add(f.AccountID, "account_id = $%d")
	}
	if f.MerchantID != 0 {
		add(f.MerchantID, "merchant_id = $%d")
	}
	if f.Kind != "" {
		add(f.Kind, "kind = $%d")
	}
	if filter := bucketFilter[f.Bucket]; filter != "" {
		conds = append(conds, "("+filter+")")
	}
	where := ""
	if len(conds) > 0 {
		where = " where " + strings.Join(conds, " and ")
	}

	if err := s.db.QueryRowContext(ctx, `
		select count(*), coalesce(sum(debit), 0), coalesce(sum(credit), 0)
		from transaction`+where, args...).Scan(&out.TotalCount, &out.TotalDebit,
		&out.TotalCredit); err != nil {
		return out, fmt.Errorf("count transactions: %w", err)
	}

	args = append(args, f.Limit, f.Offset)
	rows, err := s.db.QueryContext(ctx, `
		select t.id, t.account_id, t.posted_date::text, t.posted_time::text,
		       t.description_raw, t.debit, t.credit, t.balance_after, t.kind,
		       t.counts_as_spending, t.merchant_id, m.canonical_name,
		       t.category_id, c.name, t.fx_currency, t.fx_amount
		from transaction t
		left join merchant m on m.id = t.merchant_id
		left join category c on c.id = t.category_id`+where+fmt.Sprintf(`
		order by t.posted_date desc, t.posted_time desc, t.id desc
		limit $%d offset $%d`, len(args)-1, len(args)), args...)
	if err != nil {
		return out, fmt.Errorf("read transactions: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var t TransactionRow
		if err := rows.Scan(&t.ID, &t.AccountID, &t.PostedDate, &t.PostedTime,
			&t.Description, &t.Debit, &t.Credit, &t.BalanceAfter, &t.Kind,
			&t.CountsAsSpending, &t.MerchantID, &t.MerchantName, &t.CategoryID,
			&t.CategoryName, &t.FxCurrency, &t.FxAmount); err != nil {
			return out, fmt.Errorf("read transaction row: %w", err)
		}
		out.Rows = append(out.Rows, t)
	}
	return out, rows.Err()
}
