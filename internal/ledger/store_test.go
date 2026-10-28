package ledger

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/stdlib"
)

// testStore builds an isolated schema from the real migrations over
// database/sql. Without DATABASE_URL the database tests skip; the filter and
// masking tests still run with an empty store because they fail before any
// query.
func testStore(t *testing.T) *Store {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL is not set")
	}
	ctx := context.Background()
	admin, err := sql.Open("pgx", url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	schema := fmt.Sprintf("test_%d_%d", time.Now().UnixNano(), os.Getpid())
	if _, err := admin.ExecContext(ctx, "create schema "+schema); err != nil {
		t.Fatalf("create schema: %v", err)
	}
	t.Cleanup(func() {
		ctx := context.Background()
		admin.ExecContext(ctx, "drop schema if exists "+schema+" cascade")
		admin.Close()
	})

	cfg, err := pgx.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	cfg.RuntimeParams["search_path"] = schema
	dsn := stdlib.RegisterConnConfig(cfg)
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		db.Close()
		stdlib.UnregisterConnConfig(dsn)
	})
	s := &Store{db: db}

	entries, err := os.ReadDir("../../api/migrations")
	if err != nil {
		t.Fatal(err)
	}
	var files []string
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".up.sql") {
			files = append(files, e.Name())
		}
	}
	sort.Strings(files)
	for _, name := range files {
		load, err := os.ReadFile("../../api/migrations/" + name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := db.ExecContext(ctx, string(load)); err != nil {
			t.Fatalf("apply %s: %v", name, err)
		}
	}
	return s
}

type txOpts struct {
	time       string
	merchantID *int64
	categoryID *int64
	fxCurrency string
	fxAmount   *int64
}

func seedAccount(t *testing.T, s *Store, number string) int64 {
	t.Helper()
	var id int64
	if err := s.db.QueryRow(
		`insert into account (bank, number, kind) values ('test', $1, 'current') returning id`,
		number).Scan(&id); err != nil {
		t.Fatalf("seed account: %v", err)
	}
	return id
}

func seedImport(t *testing.T, s *Store, accountID int64) int64 {
	t.Helper()
	var id int64
	sha := fmt.Sprintf("%064x", time.Now().UnixNano())
	if err := s.db.QueryRow(
		`insert into statement_import (account_id, file_sha256, parser, parser_version, reconciled, status)
		values ($1, $2, 'test', '1', true, 'accepted') returning id`,
		accountID, sha).Scan(&id); err != nil {
		t.Fatalf("seed import: %v", err)
	}
	return id
}

func seedTransaction(t *testing.T, s *Store, accountID, importID int64,
	date string, debit, credit int64, kind string, balanceAfter *int64, o txOpts) int64 {
	t.Helper()
	var id int64
	if err := s.db.QueryRow(`
		insert into transaction (
			account_id, import_id, posted_date, posted_time, description_raw,
			debit, credit, balance_after, kind, merchant_id, category_id,
			fx_currency, fx_amount
		) values (
			$1, $2, $3, coalesce(nullif($4, ''), '00:00')::time, $5, $6, $7, $8, $9,
			$10, $11, nullif($12, ''), $13
		) returning id`,
		accountID, importID, date, o.time, kind+" row", debit, credit,
		balanceAfter, kind, o.merchantID, o.categoryID, o.fxCurrency, o.fxAmount,
	).Scan(&id); err != nil {
		t.Fatalf("seed transaction: %v", err)
	}
	return id
}

func idp(v int64) *int64 { return &v }

func TestMaskNumberHidesAllButLastFour(t *testing.T) {
	if got := MaskNumber("4012345678901234"); got != "************1234" {
		t.Fatalf("mask of 16 digits = %q", got)
	}
	if got := MaskNumber("1234"); got != "1234" {
		t.Fatalf("mask of 4 digits = %q", got)
	}
	if got := MaskNumber("12"); got != "12" {
		t.Fatalf("mask of 2 digits = %q", got)
	}
}

func TestFiltersAreValidatedBeforeAnyQuery(t *testing.T) {
	s := &Store{}
	if _, err := s.Monthly(context.Background(), "2026-02", "2026-01"); !errors.Is(err, ErrBadFilter) {
		t.Fatalf("inverted month range error = %v", err)
	}
	if _, err := s.Transactions(context.Background(), TransactionFilter{Bucket: "bad"}); !errors.Is(err, ErrBadFilter) {
		t.Fatalf("unknown bucket error = %v", err)
	}
	if _, err := s.Transactions(context.Background(), TransactionFilter{Kind: "nonsense"}); !errors.Is(err, ErrBadFilter) {
		t.Fatalf("unknown kind error = %v", err)
	}
	if _, err := s.Transactions(context.Background(), TransactionFilter{Limit: 501}); !errors.Is(err, ErrBadFilter) {
		t.Fatalf("oversized limit error = %v", err)
	}
	if _, err := s.Transactions(context.Background(), TransactionFilter{Offset: -1}); !errors.Is(err, ErrBadFilter) {
		t.Fatalf("negative offset error = %v", err)
	}
}

func TestMonthlySeparatesSpendingFromTransfersAndCardPayments(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000001")
	imp := seedImport(t, s, acc)
	rows := []struct {
		date          string
		debit, credit int64
		kind          string
	}{
		{"2026-02-01", 0, 20000, "salary"},
		{"2026-02-03", 1000, 0, "card_purchase"},
		{"2026-02-05", 5000, 0, "internal_transfer"},
		{"2026-02-06", 300, 0, "external_transfer_out"},
		{"2026-02-07", 25, 0, "roundup_sweep"},
		{"2026-02-08", 800, 0, "card_payment"},
		{"2026-02-09", 100, 0, "fee"},
	}
	for i, r := range rows {
		seedTransaction(t, s, acc, imp, r.date, r.debit, r.credit, r.kind, idp(int64(i)), txOpts{})
	}
	months, err := s.Monthly(ctx, "2026-02", "2026-02")
	if err != nil {
		t.Fatal(err)
	}
	if len(months) != 1 || months[0].Month != "2026-02" {
		t.Fatalf("months = %+v", months)
	}
	m := months[0]
	if m.Spending.Total != 1100 || m.Spending.CardPurchase != 1000 || m.Spending.Fee != 100 {
		t.Fatalf("spending = %+v", m.Spending)
	}
	if m.Transfers.Internal != 5000 || m.Transfers.ExternalOut != 300 ||
		m.Transfers.RoundupSweeps != 25 || m.Transfers.Total != 5325 {
		t.Fatalf("transfers = %+v", m.Transfers)
	}
	if m.CardPayments != 800 {
		t.Fatalf("card payments = %d", m.CardPayments)
	}
	if m.Income.Total != 20000 || m.Income.Salary != 20000 || m.Income.Other != 0 {
		t.Fatalf("income = %+v", m.Income)
	}
	if m.OutflowTotal != 7225 {
		t.Fatalf("outflow total = %d", m.OutflowTotal)
	}
	if m.TransactionCount != 7 {
		t.Fatalf("transaction count = %d", m.TransactionCount)
	}
}

func TestMonthlyCountsConfiguredPayerAsSalary(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000003")
	imp := seedImport(t, s, acc)
	id := seedTransaction(t, s, acc, imp, "2026-02-01", 0, 600000, "external_transfer_in", nil, txOpts{})
	if _, err := s.db.Exec(
		`update transaction set merchant_raw = 'SAUDI AZM COMMUNICATION AND IT' where id = $1`,
		id); err != nil {
		t.Fatal(err)
	}
	if err := s.PutSetting(ctx, SalaryPayersKey, "AZM"); err != nil {
		t.Fatal(err)
	}

	months, err := s.Monthly(ctx, "2026-02", "2026-02")
	if err != nil {
		t.Fatal(err)
	}
	m := months[0]
	if m.Income.Salary != 600000 || m.Income.TransfersIn != 0 || m.Income.Other != 0 {
		t.Fatalf("income = %+v", m.Income)
	}

	hits, err := s.Transactions(ctx, TransactionFilter{
		From: "2026-02-01", To: "2026-02-28", Bucket: "all", Kind: "salary",
	})
	if err != nil {
		t.Fatal(err)
	}
	if hits.TotalCount != 1 {
		t.Fatalf("salary drill-down rows = %d, want 1", hits.TotalCount)
	}
}

func TestExtraTransfersLeaveSpendingTotalUnchanged(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000002")
	imp := seedImport(t, s, acc)
	seedTransaction(t, s, acc, imp, "2026-05-01", 1000, 0, "card_purchase", idp(1000), txOpts{})
	months, err := s.Monthly(ctx, "2026-05", "2026-05")
	if err != nil {
		t.Fatal(err)
	}
	if months[0].Spending.Total != 1000 {
		t.Fatalf("baseline spending = %d", months[0].Spending.Total)
	}
	extra := []struct {
		debit int64
		kind  string
	}{
		{4000, "internal_transfer"},
		{300, "external_transfer_out"},
		{50, "roundup_sweep"},
		{900, "card_payment"},
	}
	for i, r := range extra {
		seedTransaction(t, s, acc, imp, fmt.Sprintf("2026-05-1%d", i), r.debit, 0, r.kind, idp(int64(i)), txOpts{})
	}
	months, err = s.Monthly(ctx, "2026-05", "2026-05")
	if err != nil {
		t.Fatal(err)
	}
	if months[0].Spending.Total != 1000 {
		t.Fatalf("spending after transfers = %d", months[0].Spending.Total)
	}
	if months[0].Transfers.Total != 4350 || months[0].CardPayments != 900 {
		t.Fatalf("transfers = %+v, card payments = %d", months[0].Transfers, months[0].CardPayments)
	}
}

func TestSpendingBucketSumsEqualMonthlyTotals(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000003")
	imp := seedImport(t, s, acc)
	seedTransaction(t, s, acc, imp, "2026-02-01", 0, 5000, "salary", idp(5000), txOpts{})
	seedTransaction(t, s, acc, imp, "2026-02-02", 1000, 0, "card_purchase", idp(4000), txOpts{})
	seedTransaction(t, s, acc, imp, "2026-02-03", 100, 0, "fee", idp(3900), txOpts{})
	seedTransaction(t, s, acc, imp, "2026-02-04", 500, 0, "bill_payment", idp(3400), txOpts{})
	seedTransaction(t, s, acc, imp, "2026-02-05", 9999, 0, "internal_transfer", idp(0), txOpts{})
	seedTransaction(t, s, acc, imp, "2026-03-01", 700, 0, "online_purchase", idp(700), txOpts{})

	months, err := s.Monthly(ctx, "2026-02", "2026-03")
	if err != nil {
		t.Fatal(err)
	}
	if len(months) != 2 {
		t.Fatalf("months = %+v", months)
	}
	ranges := [][2]string{{"2026-02-01", "2026-02-28"}, {"2026-03-01", "2026-03-31"}}
	for i, rr := range ranges {
		res, err := s.Transactions(ctx, TransactionFilter{From: rr[0], To: rr[1], Bucket: "spending"})
		if err != nil {
			t.Fatal(err)
		}
		var debit int64
		for _, row := range res.Rows {
			if !row.CountsAsSpending || row.Debit <= 0 {
				t.Fatalf("bucket row is not spending: %+v", row)
			}
			debit += row.Debit
		}
		if debit != months[i].Spending.Total {
			t.Fatalf("bucket debit %d != monthly spending %d for %s", debit, months[i].Spending.Total, months[i].Month)
		}
		if res.TotalDebit != months[i].Spending.Total {
			t.Fatalf("total_debit %d != monthly spending %d", res.TotalDebit, months[i].Spending.Total)
		}
	}

	all, err := s.Transactions(ctx, TransactionFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if all.TotalCount != 6 || len(all.Rows) != 6 {
		t.Fatalf("unfiltered total = %d, rows = %d, want 6", all.TotalCount, len(all.Rows))
	}
}

func TestSpendingByTimeGroupsHoursAndSeparatesUntimed(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000005")
	imp := seedImport(t, s, acc)
	seedTransaction(t, s, acc, imp, "2026-06-01", 1000, 0, "card_purchase", idp(0), txOpts{time: "09:15:00"})
	seedTransaction(t, s, acc, imp, "2026-06-02", 500, 0, "card_purchase", idp(0), txOpts{time: "09:45:00"})
	seedTransaction(t, s, acc, imp, "2026-06-03", 2000, 0, "bill_payment", idp(0), txOpts{time: "21:30:00"})
	seedTransaction(t, s, acc, imp, "2026-06-04", 700, 0, "card_purchase", idp(0), txOpts{})
	seedTransaction(t, s, acc, imp, "2026-06-05", 999, 0, "internal_transfer", idp(0), txOpts{time: "12:00:00"})
	seedTransaction(t, s, acc, imp, "2026-06-06", 20, 0, "fee", idp(0), txOpts{time: "00:00:00"})

	result, err := s.SpendingByTime(ctx, "2026-06", "2026-06")
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Hours) != 24 {
		t.Fatalf("hours = %d, want 24", len(result.Hours))
	}
	if got := result.Hours[9]; got.Debit != 1500 || got.Count != 2 {
		t.Fatalf("09:00 bucket = %+v", got)
	}
	if got := result.Hours[21]; got.Debit != 2000 || got.Count != 1 {
		t.Fatalf("21:00 bucket = %+v", got)
	}
	if result.TimedCount != 3 || result.UntimedCount != 2 {
		t.Fatalf("timed = %d, untimed = %d", result.TimedCount, result.UntimedCount)
	}
}

func TestUncategorisedSpendingCountsOnlyMissingCategory(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000004")
	imp := seedImport(t, s, acc)
	var catID int64
	if err := s.db.QueryRow(`insert into category (name) values ('groceries') returning id`).Scan(&catID); err != nil {
		t.Fatal(err)
	}
	seedTransaction(t, s, acc, imp, "2026-04-01", 600, 0, "card_purchase", idp(0), txOpts{})
	seedTransaction(t, s, acc, imp, "2026-04-02", 400, 0, "card_purchase", idp(0), txOpts{categoryID: &catID})
	seedTransaction(t, s, acc, imp, "2026-04-03", 50, 0, "fee", idp(0), txOpts{})

	months, err := s.Monthly(ctx, "2026-04", "2026-04")
	if err != nil {
		t.Fatal(err)
	}
	if months[0].UncategorisedSpending != 650 {
		t.Fatalf("uncategorised = %d, want 650", months[0].UncategorisedSpending)
	}
	if months[0].Spending.Total != 1050 {
		t.Fatalf("spending = %d", months[0].Spending.Total)
	}
	res, err := s.Transactions(ctx, TransactionFilter{From: "2026-04-01", To: "2026-04-30", Bucket: "uncategorised"})
	if err != nil {
		t.Fatal(err)
	}
	if res.TotalDebit != 650 {
		t.Fatalf("uncategorised bucket total = %d", res.TotalDebit)
	}
}

func TestCreditCardCoverageReportsUncoveredShare(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000005")
	imp := seedImport(t, s, acc)
	seedTransaction(t, s, acc, imp, "2026-05-01", 800, 0, "card_payment", idp(0), txOpts{})
	seedTransaction(t, s, acc, imp, "2026-05-02", 300, 0, "intl_purchase", idp(0), txOpts{})
	seedTransaction(t, s, acc, imp, "2026-05-03", 200, 0, "card_purchase", idp(0), txOpts{})
	seedTransaction(t, s, acc, imp, "2026-06-01", 100, 0, "card_purchase", idp(0), txOpts{})

	months, err := s.Monthly(ctx, "2026-05", "2026-06")
	if err != nil {
		t.Fatal(err)
	}
	if len(months) != 2 {
		t.Fatalf("months = %+v", months)
	}
	cov := months[0].CreditCardCoverage
	if cov.CardPayments != 800 || cov.PurchasesRecorded != 500 ||
		cov.Uncovered != 300 || cov.UncoveredShare != 0.375 {
		t.Fatalf("coverage = %+v", cov)
	}
	empty := months[1].CreditCardCoverage
	if empty.CardPayments != 0 || empty.UncoveredShare != 0 {
		t.Fatalf("empty coverage = %+v", empty)
	}
}

func TestAccountBalanceIsLatestBalanceAfter(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000006")
	imp := seedImport(t, s, acc)
	seedTransaction(t, s, acc, imp, "2026-06-01", 0, 2000, "external_transfer_in", idp(2000), txOpts{})
	seedTransaction(t, s, acc, imp, "2026-06-10", 500, 0, "card_purchase", idp(1500), txOpts{})
	seedAccount(t, s, "00000000000007")

	accounts, err := s.Accounts(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(accounts) != 2 {
		t.Fatalf("accounts = %+v", accounts)
	}
	byID := map[int64]Account{}
	for _, a := range accounts {
		byID[a.ID] = a
	}
	first := byID[acc]
	if first.Balance == nil || *first.Balance != 1500 || first.BalanceDate == nil || *first.BalanceDate != "2026-06-10" {
		t.Fatalf("balance = %v on %v", first.Balance, first.BalanceDate)
	}
	if first.Number == nil || *first.Number != "**********0006" {
		t.Fatalf("masked number = %v", first.Number)
	}
	payload, err := json.Marshal(accounts)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(payload), "00000000000006") {
		t.Fatal("full account number escaped the mask")
	}
	empty := byID[accounts[1].ID]
	if empty.Balance != nil || empty.BalanceDate != nil || empty.Number == nil || *empty.Number != "**********0007" {
		t.Fatalf("account without transactions = %+v", empty)
	}
}

func TestAccountWithNoTransactionsShowsEmptyMask(t *testing.T) {
	if got := MaskNumber(""); got != "" {
		t.Fatalf("mask of empty number = %q", got)
	}
}

func TestTransactionFilterByMerchantID(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000008")
	imp := seedImport(t, s, acc)
	var cat1, cat2 int64
	if err := s.db.QueryRow(`insert into category (name) values ('groceries') returning id`).Scan(&cat1); err != nil {
		t.Fatal(err)
	}
	if err := s.db.QueryRow(`insert into category (name) values ('fuel') returning id`).Scan(&cat2); err != nil {
		t.Fatal(err)
	}
	var merch1, merch2 int64
	if err := s.db.QueryRow(`insert into merchant (canonical_name) values ('Market A') returning id`).Scan(&merch1); err != nil {
		t.Fatal(err)
	}
	if err := s.db.QueryRow(`insert into merchant (canonical_name) values ('Gas Station B') returning id`).Scan(&merch2); err != nil {
		t.Fatal(err)
	}
	seedTransaction(t, s, acc, imp, "2026-07-01", 1000, 0, "card_purchase", idp(0), txOpts{merchantID: &merch1, categoryID: &cat1})
	seedTransaction(t, s, acc, imp, "2026-07-02", 500, 0, "card_purchase", idp(0), txOpts{merchantID: &merch1, categoryID: &cat1})
	seedTransaction(t, s, acc, imp, "2026-07-03", 800, 0, "card_purchase", idp(0), txOpts{merchantID: &merch2, categoryID: &cat2})

	res, err := s.Transactions(ctx, TransactionFilter{MerchantID: merch1})
	if err != nil {
		t.Fatal(err)
	}
	if res.TotalCount != 2 {
		t.Fatalf("merchant 1 count = %d, want 2", res.TotalCount)
	}
	if res.TotalDebit != 1500 {
		t.Fatalf("merchant 1 debit = %d, want 1500", res.TotalDebit)
	}
	if len(res.Rows) != 2 {
		t.Fatalf("merchant 1 rows = %d, want 2", len(res.Rows))
	}

	res, err = s.Transactions(ctx, TransactionFilter{MerchantID: merch2})
	if err != nil {
		t.Fatal(err)
	}
	if res.TotalCount != 1 {
		t.Fatalf("merchant 2 count = %d, want 1", res.TotalCount)
	}
	if res.TotalDebit != 800 {
		t.Fatalf("merchant 2 debit = %d, want 800", res.TotalDebit)
	}

	res, err = s.Transactions(ctx, TransactionFilter{From: "2026-07-01", To: "2026-07-02", MerchantID: merch1})
	if err != nil {
		t.Fatal(err)
	}
	if res.TotalCount != 2 {
		t.Fatalf("filtered by merchant and date count = %d, want 2", res.TotalCount)
	}
	if res.TotalDebit != 1500 {
		t.Fatalf("filtered by merchant and date debit = %d, want 1500", res.TotalDebit)
	}
}
