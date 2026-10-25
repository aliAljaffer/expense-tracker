package ledger

import (
	"context"
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
		if got := formatHalalas(tt.halalas); got != tt.want {
			t.Errorf("formatHalalas(%d) = %q, want %q", tt.halalas, got, tt.want)
		}
	}
}

func seedMerchant(t *testing.T, s *Store, name string) int64 {
	t.Helper()
	var id int64
	if err := s.db.QueryRow(
		`insert into merchant (canonical_name) values ($1) returning id`,
		name).Scan(&id); err != nil {
		t.Fatalf("seed merchant: %v", err)
	}
	return id
}

func seedBNPLMerchant(t *testing.T, s *Store, name string) int64 {
	t.Helper()
	var id int64
	if err := s.db.QueryRow(
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
