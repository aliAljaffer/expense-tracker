package importer

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"testing"

	"github.com/aliAljaffer/grooszy/parsers/statement"
)

func TestUploadResumeAndCommit(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()
	svc := NewService(store)

	stmt := &statement.Statement{
		Parser:            "alinma",
		ParserVersion:     "1",
		Bank:              "alinma",
		AccountNumber:     "12345000001",
		Currency:          "SAR",
		CustomerName:      "TEST USER",
		PeriodStart:       "2026-01-01",
		PeriodEnd:         "2026-01-31",
		OpeningBalance:    int64Ptr(100000),
		ClosingBalance:    int64Ptr(178425),
		StatedDebitTotal:  int64Ptr(2575),
		StatedCreditTotal: int64Ptr(81000),
		StatedDebitCount:  intPtr(1),
		StatedCreditCount: intPtr(1),
		Transactions: []statement.Transaction{
			{
				PostedDate:     "2026-01-05",
				DescriptionRaw: "card purchase",
				Debit:          2575,
				Credit:         0,
				Kind:           "card_purchase",
			},
			{
				PostedDate:     "2026-01-06",
				DescriptionRaw: "salary",
				Debit:          0,
				Credit:         81000,
				Kind:           "salary",
			},
		},
	}

	stmtData := []byte("test file data 1")
	svc.parse = func([]byte) (*statement.Statement, error) {
		return stmt, nil
	}

	t.Run("UploadTwiceResume", func(t *testing.T) {
		prev1, err := svc.Upload(ctx, stmtData)
		if err != nil {
			t.Fatalf("first upload: %v", err)
		}
		if prev1.Status != "pending" {
			t.Errorf("status = %s, want pending", prev1.Status)
		}
		if prev1.AlreadyImported {
			t.Error("AlreadyImported should be false on first upload")
		}
		if prev1.Resumed {
			t.Error("Resumed should be false on first upload")
		}
		importID1 := prev1.ImportID
		rows1 := len(prev1.Rows)

		prev2, err := svc.Upload(ctx, stmtData)
		if err != nil {
			t.Fatalf("second upload: %v", err)
		}
		if prev2.ImportID != importID1 {
			t.Errorf("ImportID = %d, want %d", prev2.ImportID, importID1)
		}
		if prev2.Status != "pending" {
			t.Errorf("status = %s, want pending", prev2.Status)
		}
		if prev2.AlreadyImported {
			t.Error("AlreadyImported should be false for pending resumed import")
		}
		if !prev2.Resumed {
			t.Error("Resumed should be true on resumed upload")
		}
		if len(prev2.Rows) != rows1 {
			t.Errorf("rows = %d, want %d", len(prev2.Rows), rows1)
		}

		def1 := prev1.DefaultSelection()
		def2 := prev2.DefaultSelection()
		if len(def1) != len(def2) {
			t.Errorf("default selection size = %d, want %d", len(def2), len(def1))
		}

		result, err := svc.Commit(ctx, importID1, nil)
		if err != nil {
			t.Fatalf("commit: %v", err)
		}
		if result.ImportID != importID1 {
			t.Errorf("commit ImportID = %d, want %d", result.ImportID, importID1)
		}
		if result.Inserted < 1 {
			t.Errorf("inserted = %d, want at least 1", result.Inserted)
		}
	})

	t.Run("UploadCommitUploadAgain", func(t *testing.T) {
		stmtData2 := []byte("test file data 2")
		prev1, err := svc.Upload(ctx, stmtData2)
		if err != nil {
			t.Fatalf("first upload: %v", err)
		}
		importID1 := prev1.ImportID

		_, err = svc.Commit(ctx, importID1, nil)
		if err != nil {
			t.Fatalf("commit: %v", err)
		}

		prev2, err := svc.Upload(ctx, stmtData2)
		if err != nil {
			t.Fatalf("second upload after commit: %v", err)
		}
		if !prev2.AlreadyImported {
			t.Error("AlreadyImported should be true for accepted import")
		}
		if prev2.Resumed {
			t.Error("Resumed should be false for accepted import")
		}
	})

	t.Run("UploadExpirePreviewUploadAgain", func(t *testing.T) {
		stmtData3 := []byte("test file data 3")
		prev1, err := svc.Upload(ctx, stmtData3)
		if err != nil {
			t.Fatalf("first upload: %v", err)
		}
		importID1 := prev1.ImportID

		hash := sha256.Sum256(stmtData3)
		hashStr := hex.EncodeToString(hash[:])

		rec, err := store.ImportByHash(ctx, hashStr)
		if err != nil {
			t.Fatalf("ImportByHash: %v", err)
		}
		if rec.ID != importID1 {
			t.Errorf("import ID = %d, want %d", rec.ID, importID1)
		}

		if _, err := store.Pool().Exec(ctx,
			`update import_preview set expires_at = now() - interval '1 second' where import_id = $1`,
			importID1); err != nil {
			t.Fatalf("expire preview: %v", err)
		}

		prev2, err := svc.Upload(ctx, stmtData3)
		if err != nil {
			t.Fatalf("second upload after expire: %v", err)
		}

		if prev2.ImportID == importID1 {
			t.Errorf("ImportID should differ after preview expiry, got same ID %d", importID1)
		}
		if prev2.AlreadyImported {
			t.Error("AlreadyImported should be false after preview expiry (new parse)")
		}
		if prev2.Resumed {
			t.Error("Resumed should be false for new upload after expiry")
		}
	})
}

func TestResumeWithCancel(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()
	svc := NewService(store)

	stmt := &statement.Statement{
		Parser:            "alinma",
		ParserVersion:     "1",
		Bank:              "alinma",
		AccountNumber:     "12345000002",
		Currency:          "SAR",
		PeriodStart:       "2026-02-01",
		PeriodEnd:         "2026-02-28",
		OpeningBalance:    int64Ptr(100000),
		ClosingBalance:    int64Ptr(97425),
		StatedDebitTotal:  int64Ptr(2575),
		StatedCreditTotal: int64Ptr(0),
		StatedDebitCount:  intPtr(1),
		StatedCreditCount: intPtr(0),
		Transactions: []statement.Transaction{
			{
				PostedDate:     "2026-02-05",
				DescriptionRaw: "card purchase",
				Debit:          2575,
				Credit:         0,
				Kind:           "card_purchase",
			},
		},
	}

	stmtData := []byte("test file data cancel")
	svc.parse = func([]byte) (*statement.Statement, error) {
		return stmt, nil
	}

	prev1, err := svc.Upload(ctx, stmtData)
	if err != nil {
		t.Fatalf("first upload: %v", err)
	}
	importID1 := prev1.ImportID

	prev2, err := svc.Upload(ctx, stmtData)
	if err != nil {
		t.Fatalf("second upload: %v", err)
	}
	if prev2.ImportID != importID1 {
		t.Errorf("ImportID = %d, want %d (resumed)", prev2.ImportID, importID1)
	}
	if !prev2.Resumed {
		t.Error("Resumed should be true")
	}

	if err := svc.Cancel(ctx, importID1); err != nil {
		t.Fatalf("cancel: %v", err)
	}

	prev3, err := svc.Upload(ctx, stmtData)
	if err != nil {
		t.Fatalf("third upload after cancel: %v", err)
	}
	if prev3.ImportID == importID1 {
		t.Errorf("ImportID should differ after cancel, got same ID %d", importID1)
	}
	if prev3.Resumed {
		t.Error("Resumed should be false for new upload after cancel")
	}
}

func TestResumeExpiryCleanup(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()
	svc := NewService(store)

	stmt := &statement.Statement{
		Parser:            "alinma",
		ParserVersion:     "1",
		Bank:              "alinma",
		AccountNumber:     "12345000003",
		Currency:          "SAR",
		PeriodStart:       "2026-03-01",
		PeriodEnd:         "2026-03-31",
		OpeningBalance:    int64Ptr(100000),
		ClosingBalance:    int64Ptr(97425),
		StatedDebitTotal:  int64Ptr(2575),
		StatedCreditTotal: int64Ptr(0),
		StatedDebitCount:  intPtr(1),
		StatedCreditCount: intPtr(0),
		Transactions: []statement.Transaction{
			{
				PostedDate:     "2026-03-05",
				DescriptionRaw: "card purchase",
				Debit:          2575,
				Credit:         0,
				Kind:           "card_purchase",
			},
		},
	}

	stmtData := []byte("test file data cleanup")
	svc.parse = func([]byte) (*statement.Statement, error) {
		return stmt, nil
	}

	prev1, err := svc.Upload(ctx, stmtData)
	if err != nil {
		t.Fatalf("first upload: %v", err)
	}
	importID1 := prev1.ImportID

	prev2, err := svc.Upload(ctx, stmtData)
	if err != nil {
		t.Fatalf("second upload: %v", err)
	}
	if !prev2.Resumed {
		t.Error("Resumed should be true on second upload")
	}

	if _, err := store.Pool().Exec(ctx,
		`update statement_import set created_at = now() - interval '25 hours' where id = $1`,
		importID1); err != nil {
		t.Fatalf("age record: %v", err)
	}

	if err := svc.Cleanup(ctx); err != nil {
		t.Fatalf("cleanup: %v", err)
	}

	rec, err := store.ImportByID(ctx, importID1)
	if err == nil && rec.Status == "pending" {
		t.Errorf("stale pending import should have been cleaned up, but import %d still exists", importID1)
	}
}
