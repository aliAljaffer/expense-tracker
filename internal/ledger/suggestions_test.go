package ledger

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

func TestCardCoverageWithNoPayments(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000010")
	imp := seedImport(t, s, acc)
	seedTransaction(t, s, acc, imp, "2026-02-01", 1000, 0, "card_purchase", idp(1000), txOpts{})

	result, err := s.CardCoverage(ctx, "2026-02", "2026-02")
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "insufficient_data" {
		t.Fatalf("status = %q, want insufficient_data", result.Status)
	}
}

func TestCardCoverageWithUncoveredPayments(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000011")
	imp := seedImport(t, s, acc)
	seedTransaction(t, s, acc, imp, "2026-02-01", 5000, 0, "card_payment", idp(5000), txOpts{})
	seedTransaction(t, s, acc, imp, "2026-02-02", 1000, 0, "card_purchase", idp(4000), txOpts{})

	result, err := s.CardCoverage(ctx, "2026-02", "2026-02")
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "ok" {
		t.Fatalf("status = %q", result.Status)
	}
	if len(result.Evidence.Months) != 1 {
		t.Fatalf("months count = %d, want 1", len(result.Evidence.Months))
	}
	m := result.Evidence.Months[0]
	if m.Uncovered != 4000 {
		t.Fatalf("uncovered = %d, want 4000", m.Uncovered)
	}
	if m.Month != "2026-02" {
		t.Fatalf("month = %q", m.Month)
	}
	if len(m.TransactionIDs) != 1 {
		t.Fatalf("transaction ids = %d, want 1", len(m.TransactionIDs))
	}
}

func TestRecurringWithInsufficientOccurrences(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000012")
	imp := seedImport(t, s, acc)

	mid := seedMerchant(t, s, "Cafe")
	seedTransaction(t, s, acc, imp, "2026-02-01", 500, 0, "card_purchase", idp(500), txOpts{merchantID: &mid})
	seedTransaction(t, s, acc, imp, "2026-02-15", 500, 0, "card_purchase", idp(0), txOpts{merchantID: &mid})

	result, err := s.Recurring(ctx, "2026-02", "2026-02")
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "insufficient_data" {
		t.Fatalf("status = %q, want insufficient_data", result.Status)
	}
}

func TestRecurringWithMultipleMerchants(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000013")
	imp := seedImport(t, s, acc)

	cafeID := seedMerchant(t, s, "Cafe Noir")
	rentID := seedMerchant(t, s, "Rent Agency")

	for month := 1; month <= 3; month++ {
		date := dateString(2026, month, 1)
		seedTransaction(t, s, acc, imp, date, 2500, 0, "card_purchase", idp(int64(2500*month)), txOpts{merchantID: &cafeID})
		seedTransaction(t, s, acc, imp, dateString(2026, month, 5), 50000, 0, "card_purchase", idp(int64(50000*month)), txOpts{merchantID: &rentID})
	}

	result, err := s.Recurring(ctx, "2026-01", "2026-03")
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "ok" {
		t.Fatalf("status = %q, want ok", result.Status)
	}
	if len(result.Evidence.Series) != 2 {
		t.Fatalf("series count = %d, want 2", len(result.Evidence.Series))
	}

	rent := result.Evidence.Series[0]
	if rent.Merchant != "Rent Agency" {
		t.Fatalf("largest merchant = %q", rent.Merchant)
	}
	if rent.Count != 3 || rent.DistinctMonths != 3 {
		t.Fatalf("rent count = %d/%d, want 3/3", rent.Count, rent.DistinctMonths)
	}
	if rent.MedianAmount != 50000 {
		t.Fatalf("rent median = %d, want 50000", rent.MedianAmount)
	}

	cafe := result.Evidence.Series[1]
	if cafe.Merchant != "Cafe Noir" {
		t.Fatalf("cafe merchant = %q", cafe.Merchant)
	}
	if cafe.Count != 3 || cafe.DistinctMonths != 3 {
		t.Fatalf("cafe count = %d/%d, want 3/3", cafe.Count, cafe.DistinctMonths)
	}
	if len(cafe.TransactionIDs) != 3 {
		t.Fatalf("cafe transaction ids = %d, want 3", len(cafe.TransactionIDs))
	}
	if want := "2 recurring payments found. The largest is Rent Agency (500.00 SAR/month)."; result.Summary != want {
		t.Fatalf("summary = %q, want %q", result.Summary, want)
	}
}

func TestRecurringRequires3DistinctMonths(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000014")
	imp := seedImport(t, s, acc)

	storeID := seedMerchant(t, s, "Store")
	seedTransaction(t, s, acc, imp, "2026-01-05", 1000, 0, "card_purchase", idp(1000), txOpts{merchantID: &storeID})
	seedTransaction(t, s, acc, imp, "2026-02-05", 1050, 0, "card_purchase", idp(0), txOpts{merchantID: &storeID})
	seedTransaction(t, s, acc, imp, "2026-03-05", 1000, 0, "card_purchase", idp(0), txOpts{merchantID: &storeID})
	seedTransaction(t, s, acc, imp, "2026-03-20", 950, 0, "card_purchase", idp(0), txOpts{merchantID: &storeID})

	result, err := s.Recurring(ctx, "2026-01", "2026-03")
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "ok" {
		t.Fatalf("status = %q", result.Status)
	}
	if len(result.Evidence.Series) != 1 {
		t.Fatalf("series count = %d, want 1", len(result.Evidence.Series))
	}
	series := result.Evidence.Series[0]
	if series.DistinctMonths != 3 {
		t.Fatalf("distinct months = %d, want 3", series.DistinctMonths)
	}
}

func TestRecurringWithMissingMonth(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000019")
	imp := seedImport(t, s, acc)

	subID := seedMerchant(t, s, "Subscription")
	seedTransaction(t, s, acc, imp, "2026-01-01", 10000, 0, "card_purchase", idp(10000), txOpts{merchantID: &subID})
	seedTransaction(t, s, acc, imp, "2026-02-01", 10000, 0, "card_purchase", idp(0), txOpts{merchantID: &subID})
	seedTransaction(t, s, acc, imp, "2026-04-01", 10000, 0, "card_purchase", idp(0), txOpts{merchantID: &subID})

	result, err := s.Recurring(ctx, "2026-01", "2026-04")
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "insufficient_data" {
		t.Fatalf("status = %q, want insufficient_data due to gap exceeding 45 days", result.Status)
	}
}

func TestRecurringWithErrraticAmounts(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000020")
	imp := seedImport(t, s, acc)

	storeID := seedMerchant(t, s, "Erratic Store")
	seedTransaction(t, s, acc, imp, "2026-01-05", 5000, 0, "card_purchase", idp(5000), txOpts{merchantID: &storeID})
	seedTransaction(t, s, acc, imp, "2026-02-05", 100000, 0, "card_purchase", idp(0), txOpts{merchantID: &storeID})
	seedTransaction(t, s, acc, imp, "2026-03-05", 2000, 0, "card_purchase", idp(0), txOpts{merchantID: &storeID})

	result, err := s.Recurring(ctx, "2026-01", "2026-03")
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "insufficient_data" {
		t.Fatalf("status = %q, want insufficient_data due to erratic amounts", result.Status)
	}
}

func TestRecurringMonthlySubscription(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000021")
	imp := seedImport(t, s, acc)

	subID := seedMerchant(t, s, "Monthly Sub")
	seedTransaction(t, s, acc, imp, "2026-01-15", 15000, 0, "card_purchase", idp(15000), txOpts{merchantID: &subID})
	seedTransaction(t, s, acc, imp, "2026-02-15", 15000, 0, "card_purchase", idp(0), txOpts{merchantID: &subID})
	seedTransaction(t, s, acc, imp, "2026-03-15", 15000, 0, "card_purchase", idp(0), txOpts{merchantID: &subID})

	result, err := s.Recurring(ctx, "2026-01", "2026-03")
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "ok" {
		t.Fatalf("status = %q, want ok", result.Status)
	}
	if len(result.Evidence.Series) != 1 {
		t.Fatalf("series count = %d, want 1", len(result.Evidence.Series))
	}
	series := result.Evidence.Series[0]
	if series.CadenceDays == nil || *series.CadenceDays < 25 || *series.CadenceDays > 35 {
		t.Fatalf("cadence_days = %v, want ~30", series.CadenceDays)
	}
}

func TestBNPLWithNoMerchants(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000015")
	imp := seedImport(t, s, acc)
	seedTransaction(t, s, acc, imp, "2026-02-01", 5000, 0, "card_payment", idp(5000), txOpts{})

	result, err := s.BNPL(ctx, "2026-02", "2026-02")
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "insufficient_data" {
		t.Fatalf("status = %q, want insufficient_data", result.Status)
	}
}

func TestBNPLWithInsufficientMonths(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000016")
	imp := seedImport(t, s, acc)

	bnplID := seedBNPLMerchant(t, s, "BNPL Store")
	seedTransaction(t, s, acc, imp, "2026-01-05", 1000, 0, "card_purchase", idp(1000), txOpts{merchantID: &bnplID})
	seedTransaction(t, s, acc, imp, "2026-02-05", 1200, 0, "card_purchase", idp(0), txOpts{merchantID: &bnplID})

	result, err := s.BNPL(ctx, "2026-01", "2026-02")
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "insufficient_data" {
		t.Fatalf("status = %q, want insufficient_data", result.Status)
	}
}

func TestBNPLRisingTrend(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000017")
	imp := seedImport(t, s, acc)

	bnplID := seedBNPLMerchant(t, s, "BNPL Store")
	seedTransaction(t, s, acc, imp, "2026-01-05", 2000, 0, "card_purchase", idp(2000), txOpts{merchantID: &bnplID})
	seedTransaction(t, s, acc, imp, "2026-02-05", 2500, 0, "card_purchase", idp(0), txOpts{merchantID: &bnplID})
	seedTransaction(t, s, acc, imp, "2026-03-05", 3000, 0, "card_purchase", idp(0), txOpts{merchantID: &bnplID})
	seedTransaction(t, s, acc, imp, "2026-03-10", 1000, 0, "card_purchase", idp(0), txOpts{merchantID: &bnplID})
	seedTransaction(t, s, acc, imp, "2026-04-05", 4500, 0, "card_purchase", idp(0), txOpts{merchantID: &bnplID})

	result, err := s.BNPL(ctx, "2026-01", "2026-04")
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "ok" {
		t.Fatalf("status = %q", result.Status)
	}
	if len(result.Evidence.Months) != 4 {
		t.Fatalf("evidence months = %d, want 4", len(result.Evidence.Months))
	}

	latest := result.Evidence.Months[len(result.Evidence.Months)-1]
	if latest.Month != "2026-04" {
		t.Fatalf("latest month = %q, want 2026-04", latest.Month)
	}
	if !latest.IsRising {
		t.Fatalf("latest month is not marked as rising")
	}
	if latest.BNPLOutflow != 4500 {
		t.Fatalf("latest outflow = %d, want 4500", latest.BNPLOutflow)
	}
	if want := "BNPL commitments are rising: 45.00 SAR this month vs 36.66 SAR average."; result.Summary != want {
		t.Fatalf("summary = %q, want %q", result.Summary, want)
	}
}

func TestBNPLFlatTrend(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000018")
	imp := seedImport(t, s, acc)

	bnplID := seedBNPLMerchant(t, s, "BNPL Flat")
	seedTransaction(t, s, acc, imp, "2026-01-05", 2000, 0, "card_purchase", idp(2000), txOpts{merchantID: &bnplID})
	seedTransaction(t, s, acc, imp, "2026-02-05", 2000, 0, "card_purchase", idp(0), txOpts{merchantID: &bnplID})
	seedTransaction(t, s, acc, imp, "2026-03-05", 2000, 0, "card_purchase", idp(0), txOpts{merchantID: &bnplID})
	seedTransaction(t, s, acc, imp, "2026-04-05", 2000, 0, "card_purchase", idp(0), txOpts{merchantID: &bnplID})

	result, err := s.BNPL(ctx, "2026-01", "2026-04")
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "ok" {
		t.Fatalf("status = %q", result.Status)
	}
	if len(result.Evidence.Months) != 4 {
		t.Fatalf("evidence months = %d, want 4", len(result.Evidence.Months))
	}

	latest := result.Evidence.Months[len(result.Evidence.Months)-1]
	if latest.IsRising {
		t.Fatalf("latest month should not be marked as rising for flat trend")
	}
	if want := "BNPL commitments are stable or falling: 20.00 SAR this month vs 20.00 SAR average."; result.Summary != want {
		t.Fatalf("summary = %q, want %q", result.Summary, want)
	}
}

func TestFormatHalalas(t *testing.T) {
	tests := []struct {
		halalas int64
		want    string
	}{
		{0, "0.00 SAR"},
		{1, "0.01 SAR"},
		{99, "0.99 SAR"},
		{100, "1.00 SAR"},
		{1234567, "12,345.67 SAR"},
		{-1234567, "-12,345.67 SAR"},
		{123456789012, "1,234,567,890.12 SAR"},
	}
	for _, tt := range tests {
		if got := FormatHalalas(tt.halalas); got != tt.want {
			t.Errorf("FormatHalalas(%d) = %q, want %q", tt.halalas, got, tt.want)
		}
	}
}

func seedMerchant(t *testing.T, s *Store, name string) int64 {
	t.Helper()
	var id int64
	if err := s.db.QueryRow(context.Background(),
		`insert into merchant (canonical_name) values ($1) returning id`,
		name).Scan(&id); err != nil {
		t.Fatalf("seed merchant: %v", err)
	}
	return id
}

func seedBNPLMerchant(t *testing.T, s *Store, name string) int64 {
	t.Helper()
	var id int64
	if err := s.db.QueryRow(context.Background(),
		`insert into merchant (canonical_name, is_bnpl) values ($1, true) returning id`,
		name).Scan(&id); err != nil {
		t.Fatalf("seed bnpl merchant: %v", err)
	}
	return id
}

func dateString(year, month, day int) string {
	d := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
	return d.Format("2006-01-02")
}

func seedSalary(t *testing.T, s *Store, acc, imp int64, month int, total int64) {
	t.Helper()
	seedTransaction(t, s, acc, imp, dateString(2026, month, 1), 0, total, "salary", nil, txOpts{})
}

func TestSalaryTrendSteady(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000030")
	imp := seedImport(t, s, acc)
	for month := 1; month <= 3; month++ {
		seedSalary(t, s, acc, imp, month, 350000)
	}

	result, err := s.SalaryTrend(ctx, "2026-01", "2026-03")
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "ok" {
		t.Fatalf("status = %q, want ok", result.Status)
	}
	if len(result.Evidence.Months) != 3 {
		t.Fatalf("months = %d, want 3", len(result.Evidence.Months))
	}
	if result.Evidence.Months[0].DepositCount != 1 || result.Evidence.Months[0].SalaryTotal != 350000 {
		t.Fatalf("first month = %+v", result.Evidence.Months[0])
	}
	if !strings.Contains(result.Summary, "steady") {
		t.Fatalf("summary = %q, want steady", result.Summary)
	}
	if !strings.Contains(result.Summary, "3,500.00 SAR") {
		t.Fatalf("summary = %q, want formatted money", result.Summary)
	}
}

func TestSalaryTrendRising(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000031")
	imp := seedImport(t, s, acc)
	seedSalary(t, s, acc, imp, 1, 350000)
	seedSalary(t, s, acc, imp, 2, 350000)
	seedSalary(t, s, acc, imp, 3, 420000)

	result, err := s.SalaryTrend(ctx, "2026-01", "2026-03")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result.Summary, "rising 20%") {
		t.Fatalf("summary = %q, want rising 20%%", result.Summary)
	}
}

func TestSalaryTrendFalling(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000032")
	imp := seedImport(t, s, acc)
	seedSalary(t, s, acc, imp, 1, 400000)
	seedSalary(t, s, acc, imp, 2, 400000)
	seedSalary(t, s, acc, imp, 3, 340000)

	result, err := s.SalaryTrend(ctx, "2026-01", "2026-03")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result.Summary, "falling 15%") {
		t.Fatalf("summary = %q, want falling 15%%", result.Summary)
	}
}

func TestSalaryTrendInsufficientMonths(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000033")
	imp := seedImport(t, s, acc)
	seedSalary(t, s, acc, imp, 1, 350000)
	seedSalary(t, s, acc, imp, 2, 350000)

	result, err := s.SalaryTrend(ctx, "2026-01", "2026-03")
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "insufficient_data" {
		t.Fatalf("status = %q, want insufficient_data", result.Status)
	}
}

func TestSalaryTrendCountsConfiguredPayer(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	acc := seedAccount(t, s, "00000000000034")
	imp := seedImport(t, s, acc)
	for month := 1; month <= 3; month++ {
		id := seedTransaction(t, s, acc, imp, dateString(2026, month, 5), 0, 600000,
			"external_transfer_in", nil, txOpts{})
		if _, err := s.db.Exec(context.Background(),
			`update transaction set merchant_raw = 'SAUDI AZM COMMUNICATION AND IT' where id = $1`,
			id); err != nil {
			t.Fatal(err)
		}
	}
	if err := s.PutSetting(ctx, SalaryPayersKey, "Saudi Azm"); err != nil {
		t.Fatal(err)
	}

	result, err := s.SalaryTrend(ctx, "2026-01", "2026-03")
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "ok" {
		t.Fatalf("status = %q, want ok", result.Status)
	}
	if len(result.Evidence.Months) != 3 || result.Evidence.Months[0].SalaryTotal != 600000 {
		t.Fatalf("months = %+v", result.Evidence.Months)
	}
}

func TestSplitSalaryPayers(t *testing.T) {
	got := SplitSalaryPayers(" Saudi Azm , ,ACME ")
	if len(got) != 2 || got[0] != "saudi azm" || got[1] != "acme" {
		t.Fatalf("payers = %q", got)
	}
}

func TestTransferMatchesPair(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	outAcc := seedAccount(t, s, "00000000000040")
	inAcc := seedAccount(t, s, "00000000000041")
	outImp := seedImport(t, s, outAcc)
	inImp := seedImport(t, s, inAcc)
	seedTransaction(t, s, outAcc, outImp, "2026-02-10", 50000, 0, "internal_transfer", nil, txOpts{})
	seedTransaction(t, s, inAcc, inImp, "2026-02-11", 0, 50000, "external_transfer_in", nil, txOpts{})

	result, err := s.TransferMatches(ctx, "2026-02", "2026-02")
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "ok" {
		t.Fatalf("status = %q, want ok", result.Status)
	}
	if len(result.Evidence.Matches) != 1 {
		t.Fatalf("matches = %d, want 1", len(result.Evidence.Matches))
	}
	m := result.Evidence.Matches[0]
	if m.Amount != 50000 {
		t.Fatalf("amount = %d", m.Amount)
	}
	if m.DebitAccount != "test "+MaskNumber("00000000000040") ||
		m.CreditAccount != "test "+MaskNumber("00000000000041") {
		t.Fatalf("accounts = %q / %q", m.DebitAccount, m.CreditAccount)
	}
	if m.DebitDate != "2026-02-10" || m.CreditDate != "2026-02-11" {
		t.Fatalf("dates = %q / %q", m.DebitDate, m.CreditDate)
	}
}

func TestTransferMatchesIgnoresOutOfWindowAndDifferentAmount(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	outAcc := seedAccount(t, s, "00000000000042")
	inAcc := seedAccount(t, s, "00000000000043")
	outImp := seedImport(t, s, outAcc)
	inImp := seedImport(t, s, inAcc)
	seedTransaction(t, s, outAcc, outImp, "2026-02-10", 50000, 0, "internal_transfer", nil, txOpts{})
	seedTransaction(t, s, inAcc, inImp, "2026-02-14", 0, 50000, "external_transfer_in", nil, txOpts{})
	seedTransaction(t, s, outAcc, outImp, "2026-02-20", 70000, 0, "internal_transfer", nil, txOpts{})
	seedTransaction(t, s, inAcc, inImp, "2026-02-21", 0, 70001, "external_transfer_in", nil, txOpts{})

	result, err := s.TransferMatches(ctx, "2026-02", "2026-02")
	if err != nil {
		t.Fatal(err)
	}
	if result.Status != "insufficient_data" || len(result.Evidence.Matches) != 0 {
		t.Fatalf("status = %q, matches = %d", result.Status, len(result.Evidence.Matches))
	}
}

func TestTransferMatchesSkipsAlreadyMatched(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	outAcc := seedAccount(t, s, "00000000000044")
	inAcc := seedAccount(t, s, "00000000000045")
	outImp := seedImport(t, s, outAcc)
	inImp := seedImport(t, s, inAcc)
	debitID := seedTransaction(t, s, outAcc, outImp, "2026-02-10", 50000, 0, "internal_transfer", nil, txOpts{})
	creditID := seedTransaction(t, s, inAcc, inImp, "2026-02-11", 0, 50000, "external_transfer_in", nil, txOpts{})
	if _, err := s.db.Exec(context.Background(), `update transaction set transfer_pair_id = $1 where id = $2`, creditID, debitID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.db.Exec(context.Background(), `update transaction set transfer_pair_id = $1 where id = $2`, debitID, creditID); err != nil {
		t.Fatal(err)
	}

	result, err := s.TransferMatches(ctx, "2026-02", "2026-02")
	if err != nil {
		t.Fatal(err)
	}
	if len(result.Evidence.Matches) != 0 {
		t.Fatalf("matches = %d, want 0", len(result.Evidence.Matches))
	}
}

func TestTransferMatchesReportsInflatedSpending(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	outAcc := seedAccount(t, s, "00000000000046")
	inAcc := seedAccount(t, s, "00000000000047")
	outImp := seedImport(t, s, outAcc)
	inImp := seedImport(t, s, inAcc)
	seedTransaction(t, s, outAcc, outImp, "2026-02-10", 50000, 0, "card_purchase", nil, txOpts{})
	seedTransaction(t, s, inAcc, inImp, "2026-02-11", 0, 50000, "external_transfer_in", nil, txOpts{})

	result, err := s.TransferMatches(ctx, "2026-02", "2026-02")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result.Summary, "inflate") || !strings.Contains(result.Summary, "500.00 SAR") {
		t.Fatalf("summary = %q", result.Summary)
	}
}

func TestSuggestionDecisionStoredAndCleared(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()

	decision, err := s.SuggestionDecision(ctx, SuggestionSalaryTrend)
	if err != nil {
		t.Fatal(err)
	}
	if decision != "" {
		t.Fatalf("initial decision = %q, want empty", decision)
	}

	if err := s.SetSuggestionDecision(ctx, SuggestionSalaryTrend, DecisionDismissed); err != nil {
		t.Fatal(err)
	}
	decision, err = s.SuggestionDecision(ctx, SuggestionSalaryTrend)
	if err != nil {
		t.Fatal(err)
	}
	if decision != DecisionDismissed {
		t.Fatalf("decision = %q, want dismissed", decision)
	}

	if err := s.SetSuggestionDecision(ctx, SuggestionSalaryTrend, DecisionAcknowledged); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := s.db.QueryRow(context.Background(), `select count(*) from user_decision where kind = $1`, SuggestionSalaryTrend).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("decision rows = %d, want 1", count)
	}

	if err := s.ClearSuggestionDecision(ctx, SuggestionSalaryTrend); err != nil {
		t.Fatal(err)
	}
	decision, err = s.SuggestionDecision(ctx, SuggestionSalaryTrend)
	if err != nil {
		t.Fatal(err)
	}
	if decision != "" {
		t.Fatalf("decision after clear = %q, want empty", decision)
	}
}

func TestSuggestionDecisionRejectsUnknownKind(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if _, err := s.SuggestionDecision(ctx, "shared_expense"); !errors.Is(err, ErrBadFilter) {
		t.Fatalf("err = %v, want ErrBadFilter", err)
	}
	if err := s.SetSuggestionDecision(ctx, SuggestionBNPL, "ignored"); !errors.Is(err, ErrBadFilter) {
		t.Fatalf("err = %v, want ErrBadFilter", err)
	}
}
