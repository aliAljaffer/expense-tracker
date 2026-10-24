package ledger

import (
	"context"
	"encoding/json"
	"testing"
)

func TestAccountsReturnsEmptyArrayNotNull(t *testing.T) {
	store := testStore(t)
	defer store.Close()

	accounts, err := store.Accounts(context.Background())
	if err != nil {
		t.Fatalf("Accounts failed: %v", err)
	}

	if accounts == nil {
		t.Fatal("Accounts returned nil instead of empty slice")
	}

	if len(accounts) != 0 {
		t.Fatalf("Expected empty slice, got %d accounts", len(accounts))
	}

	data, err := json.Marshal(map[string]any{"accounts": accounts})
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	if string(data) == `{"accounts":null}` {
		t.Fatal("JSON contains null instead of []")
	}

	if !json.Valid(data) {
		t.Fatal("JSON is invalid")
	}
}

func TestMonthlyReturnsEmptyArrayNotNull(t *testing.T) {
	store := testStore(t)
	defer store.Close()

	months, err := store.Monthly(context.Background(), "2024-01", "2024-12")
	if err != nil {
		t.Fatalf("Monthly failed: %v", err)
	}

	if months == nil {
		t.Fatal("Monthly returned nil instead of empty slice")
	}

	if len(months) != 0 {
		t.Fatalf("Expected empty slice, got %d months", len(months))
	}

	data, err := json.Marshal(map[string]any{"months": months})
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	if string(data) == `{"months":null}` {
		t.Fatal("JSON contains null instead of []")
	}
}

func TestTransactionsReturnsEmptyArrayNotNull(t *testing.T) {
	store := testStore(t)
	defer store.Close()

	result, err := store.Transactions(context.Background(), TransactionFilter{})
	if err != nil {
		t.Fatalf("Transactions failed: %v", err)
	}

	if result.Rows == nil {
		t.Fatal("Rows is nil instead of empty slice")
	}

	if len(result.Rows) != 0 {
		t.Fatalf("Expected empty slice, got %d rows", len(result.Rows))
	}

	data, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	if string(data) == `{"rows":null,"total_count":0,"total_debit":0,"total_credit":0}` {
		t.Fatal("JSON contains null for rows instead of []")
	}
}

func TestCardCoverageReturnsEmptyMonthsArray(t *testing.T) {
	store := testStore(t)
	defer store.Close()

	result, err := store.CardCoverage(context.Background(), "2024-01", "2024-12")
	if err != nil {
		t.Fatalf("CardCoverage failed: %v", err)
	}

	if result.Evidence.Months == nil {
		t.Fatal("Evidence.Months is nil instead of empty slice")
	}

	if len(result.Evidence.Months) != 0 {
		t.Fatalf("Expected empty slice, got %d months", len(result.Evidence.Months))
	}

	data, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	if !json.Valid(data) {
		t.Fatal("JSON is invalid")
	}
}

func TestRecurringReturnsEmptySeriesArray(t *testing.T) {
	store := testStore(t)
	defer store.Close()

	result, err := store.Recurring(context.Background(), "2024-01", "2024-12")
	if err != nil {
		t.Fatalf("Recurring failed: %v", err)
	}

	if result.Evidence.Series == nil {
		t.Fatal("Evidence.Series is nil instead of empty slice")
	}

	if len(result.Evidence.Series) != 0 {
		t.Fatalf("Expected empty slice, got %d series", len(result.Evidence.Series))
	}

	data, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	if !json.Valid(data) {
		t.Fatal("JSON is invalid")
	}
}

func TestBNPLReturnsEmptyMonthsArray(t *testing.T) {
	store := testStore(t)
	defer store.Close()

	result, err := store.BNPL(context.Background(), "2024-01", "2024-12")
	if err != nil {
		t.Fatalf("BNPL failed: %v", err)
	}

	if result.Evidence.Months == nil {
		t.Fatal("Evidence.Months is nil instead of empty slice")
	}

	if len(result.Evidence.Months) != 0 {
		t.Fatalf("Expected empty slice, got %d months", len(result.Evidence.Months))
	}

	data, err := json.Marshal(result)
	if err != nil {
		t.Fatalf("Marshal failed: %v", err)
	}

	if !json.Valid(data) {
		t.Fatal("JSON is invalid")
	}
}
