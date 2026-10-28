package importer

import (
	"context"
	"testing"

	"github.com/aliAljaffer/grooszy/parsers/statement"
)

func TestMerchantAliasShowsOnLaterPreviewWithoutChangingFingerprint(t *testing.T) {
	store := testStore(t)
	svc := NewService(store)
	ctx := context.Background()

	first := tx("2026-01-05", 350000, 0, "rent payment")
	first.MerchantRaw = "RENT AGENCY #TRAD"
	p1 := upload(t, svc, []byte("statement one"), testStatement("00000000000011", []statement.Transaction{first}))
	if _, err := svc.Commit(ctx, p1.ImportID, nil); err != nil {
		t.Fatalf("commit: %v", err)
	}
	if p1.Rows[0].MerchantDisplay != "" {
		t.Fatalf("merchant display before any alias = %q, want empty", p1.Rows[0].MerchantDisplay)
	}

	var accountID, merchantID int64
	err := store.pool.QueryRow(ctx,
		`select account_id, coalesce(merchant_id, 0) from transaction where import_id = $1`,
		p1.ImportID).Scan(&accountID, &merchantID)
	if err != nil {
		t.Fatalf("read stored row: %v", err)
	}
	if merchantID == 0 {
		t.Fatal("stored row has no merchant")
	}

	alias := "Rent Agency"
	if _, err := store.pool.Exec(ctx,
		`update merchant set display_name = $1 where id = $2`, alias, merchantID); err != nil {
		t.Fatalf("set alias: %v", err)
	}

	second := tx("2026-02-05", 350000, 0, "rent payment")
	second.MerchantRaw = "RENT AGENCY #TRAD"
	p2 := upload(t, svc, []byte("statement two"), testStatement("00000000000011", []statement.Transaction{second}))

	if got := p2.Rows[0].MerchantDisplay; got != alias {
		t.Fatalf("merchant display = %q, want %q", got, alias)
	}
	want, err := Fingerprint(accountID, second)
	if err != nil {
		t.Fatalf("fingerprint: %v", err)
	}
	if p2.Rows[0].Fingerprint != want {
		t.Fatalf("fingerprint = %q, want %q", p2.Rows[0].Fingerprint, want)
	}

	if _, err := svc.Commit(ctx, p2.ImportID, nil); err != nil {
		t.Fatalf("commit second: %v", err)
	}
	var canonical string
	var count int
	if err := store.pool.QueryRow(ctx, `select count(*) from merchant`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("merchant count = %d, want 1", count)
	}
	if err := store.pool.QueryRow(ctx,
		`select canonical_name from merchant where id = $1`, merchantID).Scan(&canonical); err != nil {
		t.Fatal(err)
	}
	if canonical != "RENT AGENCY" {
		t.Fatalf("canonical_name = %q, want RENT AGENCY", canonical)
	}
}
