package ledger

import (
	"context"
	"errors"
	"testing"
)

func seedCategory(t *testing.T, s *Store, name string) int64 {
	t.Helper()
	var id int64
	if err := s.db.QueryRow(`insert into category (name) values ($1) returning id`, name).Scan(&id); err != nil {
		t.Fatalf("seed category: %v", err)
	}
	return id
}

func categoryOf(t *testing.T, s *Store, transactionID int64) *int64 {
	t.Helper()
	var id *int64
	if err := s.db.QueryRow(`select category_id from transaction where id = $1`, transactionID).Scan(&id); err != nil {
		t.Fatalf("read category: %v", err)
	}
	return id
}

func TestSetCategoryAppliesToEveryRowOfTheMerchant(t *testing.T) {
	s := testStore(t)
	defer s.Close()
	ctx := context.Background()

	account := seedAccount(t, s, "0001")
	importID := seedImport(t, s, account)
	rent := seedMerchant(t, s, "RENT AGENCY")
	coffee := seedMerchant(t, s, "COFFEE HOUSE")
	housing := seedCategory(t, s, "Housing")

	first := seedTransaction(t, s, account, importID, "2026-01-05", 350000, 0, "bill_payment", nil, txOpts{merchantID: &rent})
	second := seedTransaction(t, s, account, importID, "2026-01-06", 350000, 0, "bill_payment", nil, txOpts{merchantID: &rent})
	other := seedTransaction(t, s, account, importID, "2026-01-07", 1750, 0, "card_purchase", nil, txOpts{merchantID: &coffee})
	loner := seedTransaction(t, s, account, importID, "2026-01-08", 1750, 0, "card_purchase", nil, txOpts{})

	if err := s.SetCategory(ctx, first, &housing, true); err != nil {
		t.Fatalf("SetCategory: %v", err)
	}
	for _, id := range []int64{first, second} {
		if got := categoryOf(t, s, id); got == nil || *got != housing {
			t.Fatalf("transaction %d category = %v, want %d", id, got, housing)
		}
	}
	for _, id := range []int64{other, loner} {
		if got := categoryOf(t, s, id); got != nil {
			t.Fatalf("transaction %d category = %v, want null", id, *got)
		}
	}
}

func TestSetCategoryWithoutApplyLeavesSiblings(t *testing.T) {
	s := testStore(t)
	defer s.Close()
	ctx := context.Background()

	account := seedAccount(t, s, "0002")
	importID := seedImport(t, s, account)
	merchant := seedMerchant(t, s, "COFFEE HOUSE")
	dining := seedCategory(t, s, "Dining")

	first := seedTransaction(t, s, account, importID, "2026-01-05", 1750, 0, "card_purchase", nil, txOpts{merchantID: &merchant})
	second := seedTransaction(t, s, account, importID, "2026-01-06", 1750, 0, "card_purchase", nil, txOpts{merchantID: &merchant})

	if err := s.SetCategory(ctx, first, &dining, false); err != nil {
		t.Fatalf("SetCategory: %v", err)
	}
	if got := categoryOf(t, s, first); got == nil || *got != dining {
		t.Fatalf("first category = %v", got)
	}
	if got := categoryOf(t, s, second); got != nil {
		t.Fatalf("sibling category = %v, want null", *got)
	}
}

func TestSetCategoryClearsWithNull(t *testing.T) {
	s := testStore(t)
	defer s.Close()
	ctx := context.Background()

	account := seedAccount(t, s, "0003")
	importID := seedImport(t, s, account)
	dining := seedCategory(t, s, "Dining")
	row := seedTransaction(t, s, account, importID, "2026-01-05", 1750, 0, "card_purchase", nil, txOpts{categoryID: &dining})

	if err := s.SetCategory(ctx, row, nil, false); err != nil {
		t.Fatalf("SetCategory: %v", err)
	}
	if got := categoryOf(t, s, row); got != nil {
		t.Fatalf("category = %v, want null", *got)
	}
}

func TestSetCategoryRejectsUnknownTransactionAndCategory(t *testing.T) {
	s := testStore(t)
	defer s.Close()
	ctx := context.Background()

	account := seedAccount(t, s, "0004")
	importID := seedImport(t, s, account)
	row := seedTransaction(t, s, account, importID, "2026-01-05", 1750, 0, "card_purchase", nil, txOpts{})

	if err := s.SetCategory(ctx, 999999, nil, false); !errors.Is(err, ErrNotFound) {
		t.Fatalf("unknown row error = %v, want ErrNotFound", err)
	}
	missing := int64(999999)
	if err := s.SetCategory(ctx, row, &missing, false); !errors.Is(err, ErrBadCategory) {
		t.Fatalf("unknown category error = %v, want ErrBadCategory", err)
	}
}

func TestCategoriesAreListedByName(t *testing.T) {
	s := testStore(t)
	defer s.Close()

	seedCategory(t, s, "Utilities")
	seedCategory(t, s, "Dining")

	categories, err := s.Categories(context.Background())
	if err != nil {
		t.Fatalf("Categories: %v", err)
	}
	if len(categories) != 2 || categories[0].Name != "Dining" || categories[1].Name != "Utilities" {
		t.Fatalf("categories = %+v", categories)
	}
}

func TestMerchantAliasReplacesTheDisplayedName(t *testing.T) {
	s := testStore(t)
	defer s.Close()
	ctx := context.Background()

	account := seedAccount(t, s, "0005")
	importID := seedImport(t, s, account)
	merchant := seedMerchant(t, s, "RENT AGENCY")
	seedTransaction(t, s, account, importID, "2026-01-05", 350000, 0, "bill_payment", nil, txOpts{merchantID: &merchant})

	alias := "Rent Agency"
	if err := s.SetMerchantAlias(ctx, merchant, &alias); err != nil {
		t.Fatalf("SetMerchantAlias: %v", err)
	}
	result, err := s.Transactions(ctx, TransactionFilter{})
	if err != nil {
		t.Fatalf("Transactions: %v", err)
	}
	if len(result.Rows) != 1 || result.Rows[0].MerchantName == nil || *result.Rows[0].MerchantName != alias {
		t.Fatalf("merchant name = %v, want %q", result.Rows[0].MerchantName, alias)
	}

	if err := s.SetMerchantAlias(ctx, merchant, nil); err != nil {
		t.Fatalf("clear alias: %v", err)
	}
	result, err = s.Transactions(ctx, TransactionFilter{})
	if err != nil {
		t.Fatalf("Transactions: %v", err)
	}
	if got := result.Rows[0].MerchantName; got == nil || *got != "RENT AGENCY" {
		t.Fatalf("merchant name after clear = %v, want canonical", got)
	}
}

func TestSetMerchantAliasRejectsUnknownMerchant(t *testing.T) {
	s := testStore(t)
	defer s.Close()
	alias := "Rent Agency"
	if err := s.SetMerchantAlias(context.Background(), 999999, &alias); !errors.Is(err, ErrNotFound) {
		t.Fatalf("error = %v, want ErrNotFound", err)
	}
}
