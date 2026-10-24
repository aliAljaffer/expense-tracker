package importer

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aliAljaffer/expense-tracker/parsers/statement"
)

// testStore builds an isolated schema from the real migrations. Without
// DATABASE_URL the database tests skip; the unit tests still run.
func testStore(t *testing.T) *Store {
	t.Helper()
	url := os.Getenv("DATABASE_URL")
	if url == "" {
		t.Skip("DATABASE_URL is not set")
	}
	ctx := context.Background()
	admin, err := pgx.Connect(ctx, url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	schema := fmt.Sprintf("test_%d", time.Now().UnixNano())
	if _, err := admin.Exec(ctx, "create schema "+pgx.Identifier{schema}.Sanitize()); err != nil {
		t.Fatalf("create schema: %v", err)
	}
	t.Cleanup(func() {
		ctx := context.Background()
		admin.Exec(ctx, "drop schema if exists "+pgx.Identifier{schema}.Sanitize()+" cascade")
		admin.Close(ctx)
	})

	cfg, err := pgxpool.ParseConfig(url)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	store := &Store{pool: pool}
	t.Cleanup(store.Close)

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
		sql, err := os.ReadFile("../../api/migrations/" + name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := pool.Exec(ctx, string(sql)); err != nil {
			t.Fatalf("apply %s: %v", name, err)
		}
	}
	return store
}

func ptr(v int64) *int64 { return &v }

func tx(posted string, debit, credit int64, description string) statement.Transaction {
	kind := statement.CardPurchase
	if credit > 0 {
		kind = statement.ExternalTransferIn
	}
	return statement.Transaction{
		PostedDate:     posted,
		DescriptionRaw: description,
		Debit:          debit,
		Credit:         credit,
		Kind:           kind,
	}
}

func testStatement(account string, rows []statement.Transaction) *statement.Statement {
	s := &statement.Statement{
		Parser: "test", ParserVersion: "1", Bank: "alinma",
		AccountNumber: account, Currency: "SAR",
		PeriodStart: "2026-01-01", PeriodEnd: "2026-01-31",
		Transactions: rows,
	}
	var debit, credit int64
	var debitCount, creditCount int
	for _, r := range rows {
		debit += r.Debit
		credit += r.Credit
		if r.Debit > 0 {
			debitCount++
		}
		if r.Credit > 0 {
			creditCount++
		}
	}
	opening := int64(0)
	closing := credit - debit
	s.OpeningBalance = &opening
	s.ClosingBalance = &closing
	s.StatedDebitTotal = &debit
	s.StatedCreditTotal = &credit
	s.StatedDebitCount = &debitCount
	s.StatedCreditCount = &creditCount
	return s
}

func upload(t *testing.T, svc *Service, data []byte, s *statement.Statement) *Preview {
	t.Helper()
	svc.parse = func([]byte) (*statement.Statement, error) { return s, nil }
	p, err := svc.Upload(context.Background(), data)
	if err != nil {
		t.Fatalf("upload: %v", err)
	}
	return p
}

func TestUploadCommitAndFingerprintParity(t *testing.T) {
	store := testStore(t)
	svc := NewService(store)
	ctx := context.Background()
	first := tx("2026-01-05", 2575, 0, "card purchase one")
	first.BalanceAfter = ptr(-2575)
	second := tx("2026-01-06", 0, 50000, "transfer in")
	second.BalanceAfter = ptr(47425)
	third := tx("2026-01-07", 10000, 0, "international purchase")
	third.Kind = statement.IntlPurchase
	third.BalanceAfter = ptr(37425)
	third.FxCurrency = "USD"
	third.FxAmount = ptr(2667)
	third.FxRate = "3.7500000000"
	third.FxFee = ptr(250)
	rows := []statement.Transaction{first, second, third}
	p := upload(t, svc, []byte("statement one"), testStatement("00000000000001", rows))
	if p.Status != "pending" || len(p.Rows) != 3 || p.Summary.DefaultRows != 3 {
		t.Fatalf("preview = %+v", p)
	}
	if !p.Reconciliation.OK {
		t.Fatalf("reconciliation = %+v", p.Reconciliation)
	}

	res, err := svc.Commit(ctx, p.ImportID, nil)
	if err != nil {
		t.Fatalf("commit: %v", err)
	}
	if res.Inserted != 3 || res.Skipped != 0 {
		t.Fatalf("commit = %+v", res)
	}

	stored, err := store.pool.Query(ctx, `select fingerprint from transaction where import_id = $1`, p.ImportID)
	if err != nil {
		t.Fatal(err)
	}
	defer stored.Close()
	got := map[string]bool{}
	for stored.Next() {
		var fp string
		if err := stored.Scan(&fp); err != nil {
			t.Fatal(err)
		}
		got[fp] = true
	}
	for _, r := range p.Rows {
		if !got[r.Fingerprint] {
			t.Fatalf("Go fingerprint %s does not match the database generated column", r.Fingerprint)
		}
	}
}

func TestReimportSameFileAddsNothing(t *testing.T) {
	store := testStore(t)
	svc := NewService(store)
	rows := []statement.Transaction{tx("2026-01-05", 2575, 0, "card purchase one")}
	p := upload(t, svc, []byte("statement one"), testStatement("00000000000001", rows))
	if _, err := svc.Commit(context.Background(), p.ImportID, nil); err != nil {
		t.Fatal(err)
	}

	again := upload(t, svc, []byte("statement one"), testStatement("00000000000001", rows))
	if !again.AlreadyImported || again.Status != "accepted" {
		t.Fatalf("reimport = %+v", again)
	}
	var count int
	store.pool.QueryRow(context.Background(), `select count(*) from transaction`).Scan(&count)
	if count != 1 {
		t.Fatalf("transactions = %d, want 1", count)
	}
}

func TestOverlappingStatementInsertsOnlyNewRows(t *testing.T) {
	store := testStore(t)
	svc := NewService(store)
	ctx := context.Background()
	shared := tx("2026-01-05", 2575, 0, "card purchase one")
	first := []statement.Transaction{shared, tx("2026-01-06", 1000, 0, "card purchase two")}
	p := upload(t, svc, []byte("statement one"), testStatement("00000000000001", first))
	if _, err := svc.Commit(ctx, p.ImportID, nil); err != nil {
		t.Fatal(err)
	}

	overlap := []statement.Transaction{shared, tx("2026-01-07", 3000, 0, "card purchase three")}
	p2 := upload(t, svc, []byte("statement two"), testStatement("00000000000001", overlap))
	if p2.Summary.ExactDuplicates != 1 || p2.Summary.DefaultRows != 1 {
		t.Fatalf("overlap summary = %+v", p2.Summary)
	}
	res, err := svc.Commit(ctx, p2.ImportID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if res.Inserted != 1 {
		t.Fatalf("commit = %+v, want 1 inserted", res)
	}
	var count int
	store.pool.QueryRow(ctx, `select count(*) from transaction`).Scan(&count)
	if count != 3 {
		t.Fatalf("transactions = %d, want 3", count)
	}
}

func TestHeldDuplicateIsNotStoredByDefault(t *testing.T) {
	store := testStore(t)
	svc := NewService(store)
	ctx := context.Background()
	original := tx("2026-01-05", 2500, 0, "coffee shop")
	original.MerchantRaw = "SAMPLE COFFEE"
	p := upload(t, svc, []byte("statement one"), testStatement("00000000000001", []statement.Transaction{original}))
	if _, err := svc.Commit(ctx, p.ImportID, nil); err != nil {
		t.Fatal(err)
	}

	similar := tx("2026-01-05", 2500, 0, "coffee shop refunded")
	similar.MerchantRaw = "SAMPLE COFFEE"
	p2 := upload(t, svc, []byte("statement two"), testStatement("00000000000001", []statement.Transaction{similar}))
	if p2.Rows[0].Duplicate == nil || p2.Rows[0].Duplicate.Score < reviewThreshold {
		t.Fatalf("duplicate = %+v, want a held score", p2.Rows[0].Duplicate)
	}
	if p2.Summary.DefaultRows != 0 {
		t.Fatalf("default rows = %d, want 0", p2.Summary.DefaultRows)
	}
	res, err := svc.Commit(ctx, p2.ImportID, nil)
	if err != nil {
		t.Fatal(err)
	}
	if res.Inserted != 0 {
		t.Fatalf("commit = %+v, want nothing stored", res)
	}
}

func TestUnreconciledStatementCannotBeCommitted(t *testing.T) {
	store := testStore(t)
	svc := NewService(store)
	s := testStatement("00000000000001", []statement.Transaction{tx("2026-01-05", 2575, 0, "card purchase one")})
	*s.StatedDebitTotal = 1
	p := upload(t, svc, []byte("statement one"), s)
	if p.Status != "rejected" || p.Reconciliation.OK {
		t.Fatalf("preview = %+v", p)
	}
	if _, err := svc.Commit(context.Background(), p.ImportID, nil); !errors.Is(err, ErrNotPending) {
		t.Fatalf("commit error = %v, want ErrNotPending", err)
	}
}

func TestRejectedFileCanBeRetriedAfterParserFix(t *testing.T) {
	store := testStore(t)
	svc := NewService(store)
	broken := testStatement("00000000000001", []statement.Transaction{tx("2026-01-05", 2575, 0, "card purchase one")})
	*broken.StatedDebitTotal = 1
	if p := upload(t, svc, []byte("statement one"), broken); p.Status != "rejected" {
		t.Fatalf("first upload = %+v", p)
	}
	fixed := testStatement("00000000000001", []statement.Transaction{tx("2026-01-05", 2575, 0, "card purchase one")})
	p := upload(t, svc, []byte("statement one"), fixed)
	if p.Status != "pending" {
		t.Fatalf("retry = %+v, want pending", p)
	}
}

func TestCancelRemovesPendingImport(t *testing.T) {
	store := testStore(t)
	svc := NewService(store)
	p := upload(t, svc, []byte("statement one"),
		testStatement("00000000000001", []statement.Transaction{tx("2026-01-05", 2575, 0, "card purchase one")}))
	if err := svc.Cancel(context.Background(), p.ImportID); err != nil {
		t.Fatal(err)
	}
	if _, err := store.LoadPreview(context.Background(), p.ImportID); !errors.Is(err, ErrNoPreview) {
		t.Fatalf("preview after cancel = %v, want ErrNoPreview", err)
	}
}

func TestParseRejectsUnknownAndCorruptFiles(t *testing.T) {
	if _, err := Parse([]byte("hello")); !errors.Is(err, ErrUnsupported) {
		t.Fatalf("unknown file error = %v", err)
	}
	if _, err := Parse([]byte("%PDF-1.7\nnot a pdf")); !errors.Is(err, ErrUnreadable) {
		t.Fatalf("corrupt pdf error = %v", err)
	}
}
