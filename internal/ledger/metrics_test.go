package ledger

import (
	"context"
	"testing"
	"time"
)

func TestMetricsCountsTransactionsSpendingAndImports(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	account := seedAccount(t, s, "metrics")
	imp := seedImport(t, s, account)

	var cat int64
	if err := s.db.QueryRow(ctx, `insert into category (name) values ('food') returning id`).Scan(&cat); err != nil {
		t.Fatalf("seed category: %v", err)
	}

	month := time.Now().Format("2006-01")
	lastMonth := time.Now().AddDate(0, -1, 0).Format("2006-01")
	seedTransaction(t, s, account, imp, month+"-15", 10000, 0, "card_purchase", nil, txOpts{})
	seedTransaction(t, s, account, imp, month+"-15", 2500, 0, "card_purchase", nil, txOpts{categoryID: idp(cat)})
	seedTransaction(t, s, account, imp, month+"-15", 700, 0, "internal_transfer", nil, txOpts{})
	seedTransaction(t, s, account, imp, month+"-15", 500, 0, "fee", nil, txOpts{})
	seedTransaction(t, s, account, imp, lastMonth+"-15", 999, 0, "card_purchase", nil, txOpts{})

	got, err := s.Metrics(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if got.Transactions != 5 {
		t.Errorf("Transactions = %d, want 5", got.Transactions)
	}
	if got.TransactionsCurrentMonth != 4 {
		t.Errorf("TransactionsCurrentMonth = %d, want 4", got.TransactionsCurrentMonth)
	}
	if got.SpendingSARMonth != 130 {
		t.Errorf("SpendingSARMonth = %v, want 130", got.SpendingSARMonth)
	}
	if got.UncategorisedSARMonth != 105 {
		t.Errorf("UncategorisedSARMonth = %v, want 105", got.UncategorisedSARMonth)
	}
	if got.Imports != 1 {
		t.Errorf("Imports = %d, want 1", got.Imports)
	}
	if got.LastImportUnix == 0 {
		t.Error("LastImportUnix = 0, want the accepted import's created_at")
	}
}
