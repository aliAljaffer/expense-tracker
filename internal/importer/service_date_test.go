package importer

import (
	"context"
	"errors"
	"testing"

	"github.com/aliAljaffer/grooszy/parsers/statement"
)

func TestServiceUploadWithRealDateFormats(t *testing.T) {
	store := testStore(t)
	ctx := context.Background()

	// Test with Alinma format (DD/MM/YYYY)
	t.Run("Alinma_DD_MM_YYYY", func(t *testing.T) {
		stmt := &statement.Statement{
			Parser:            "alinma",
			ParserVersion:     "1",
			Bank:              "alinma",
			AccountNumber:     "12345000001",
			Currency:          "SAR",
			CustomerName:      "TEST USER",
			PeriodStart:       "25/09/2025",
			PeriodEnd:         "24/10/2025",
			OpeningBalance:    int64Ptr(100000),
			ClosingBalance:    int64Ptr(118600),
			StatedDebitTotal:  int64Ptr(62400),
			StatedCreditTotal: int64Ptr(81000),
			StatedDebitCount:  intPtr(12),
			StatedCreditCount: intPtr(3),
			Transactions: []statement.Transaction{
				{
					PostedDate:     "2025-09-25",
					DescriptionRaw: "Test transaction",
					Debit:          0,
					Credit:         81000,
					Kind:           "salary",
				},
			},
		}

		// Manually create preview for testing (mock parse)
		accountID, err := store.UpsertAccount(ctx, stmt.Bank, stmt.AccountNumber, stmt.IBAN)
		if err != nil {
			t.Fatalf("UpsertAccount: %v", err)
		}

		// Parse and normalize the dates
		periodStart, err := ParseStatementDate(stmt.PeriodStart)
		if err != nil {
			t.Fatalf("ParseStatementDate PeriodStart: %v", err)
		}
		periodEnd, err := ParseStatementDate(stmt.PeriodEnd)
		if err != nil {
			t.Fatalf("ParseStatementDate PeriodEnd: %v", err)
		}

		// Verify ISO format
		if periodStart.Format("2006-01-02") != "2025-09-25" {
			t.Errorf("periodStart = %s, want 2025-09-25", periodStart.Format("2006-01-02"))
		}
		if periodEnd.Format("2006-01-02") != "2025-10-24" {
			t.Errorf("periodEnd = %s, want 2025-10-24", periodEnd.Format("2006-01-02"))
		}

		// Insert into database
		importID, err := store.CreateImport(ctx, ImportInput{
			AccountID:      accountID,
			FileSHA256:     "abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
			Parser:         stmt.Parser,
			ParserVersion:  stmt.ParserVersion,
			PeriodStart:    periodStart.Format("2006-01-02"),
			PeriodEnd:      periodEnd.Format("2006-01-02"),
			RowCount:       len(stmt.Transactions),
			Statement:      stmt,
			Reconciliation: statement.Reconciliation{OK: true},
			Accepted:       true,
		})
		if err != nil {
			t.Fatalf("CreateImport: %v", err)
		}

		// Read back and verify dates are stored correctly
		rec, err := store.ImportByID(ctx, importID)
		if err != nil {
			t.Fatalf("ImportByID: %v", err)
		}

		if rec.PeriodStart == nil {
			t.Fatalf("PeriodStart is nil")
		}
		if *rec.PeriodStart != "2025-09-25" {
			t.Errorf("PeriodStart = %s, want 2025-09-25", *rec.PeriodStart)
		}
		if rec.PeriodEnd == nil {
			t.Fatalf("PeriodEnd is nil")
		}
		if *rec.PeriodEnd != "2025-10-24" {
			t.Errorf("PeriodEnd = %s, want 2025-10-24", *rec.PeriodEnd)
		}
	})

	// Test with Al Rajhi format (YYYY/MM/DD)
	t.Run("AlRajhi_YYYY_MM_DD", func(t *testing.T) {
		stmt := &statement.Statement{
			Parser:            "alrajhi",
			ParserVersion:     "1",
			Bank:              "alrajhi",
			AccountNumber:     "000000000000001",
			Currency:          "SAR",
			CustomerName:      "TEST USER",
			PeriodStart:       "2025/09/25",
			PeriodEnd:         "2025/10/24",
			OpeningBalance:    int64Ptr(100000),
			ClosingBalance:    int64Ptr(118600),
			StatedDebitTotal:  int64Ptr(62400),
			StatedCreditTotal: int64Ptr(81000),
			StatedDebitCount:  intPtr(12),
			StatedCreditCount: intPtr(3),
			Transactions: []statement.Transaction{
				{
					PostedDate:     "2025-09-25",
					DescriptionRaw: "Test transaction",
					Debit:          0,
					Credit:         81000,
					Kind:           "salary",
				},
			},
		}

		accountID, err := store.UpsertAccount(ctx, stmt.Bank, stmt.AccountNumber, stmt.IBAN)
		if err != nil {
			t.Fatalf("UpsertAccount: %v", err)
		}

		// Parse and normalize the dates
		periodStart, err := ParseStatementDate(stmt.PeriodStart)
		if err != nil {
			t.Fatalf("ParseStatementDate PeriodStart: %v", err)
		}
		periodEnd, err := ParseStatementDate(stmt.PeriodEnd)
		if err != nil {
			t.Fatalf("ParseStatementDate PeriodEnd: %v", err)
		}

		// Verify ISO format
		if periodStart.Format("2006-01-02") != "2025-09-25" {
			t.Errorf("periodStart = %s, want 2025-09-25", periodStart.Format("2006-01-02"))
		}
		if periodEnd.Format("2006-01-02") != "2025-10-24" {
			t.Errorf("periodEnd = %s, want 2025-10-24", periodEnd.Format("2006-01-02"))
		}

		// Insert into database
		importID, err := store.CreateImport(ctx, ImportInput{
			AccountID:      accountID,
			FileSHA256:     "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
			Parser:         stmt.Parser,
			ParserVersion:  stmt.ParserVersion,
			PeriodStart:    periodStart.Format("2006-01-02"),
			PeriodEnd:      periodEnd.Format("2006-01-02"),
			RowCount:       len(stmt.Transactions),
			Statement:      stmt,
			Reconciliation: statement.Reconciliation{OK: true},
			Accepted:       true,
		})
		if err != nil {
			t.Fatalf("CreateImport: %v", err)
		}

		// Read back and verify dates are stored correctly
		rec, err := store.ImportByID(ctx, importID)
		if err != nil {
			t.Fatalf("ImportByID: %v", err)
		}

		if rec.PeriodStart == nil {
			t.Fatalf("PeriodStart is nil")
		}
		if *rec.PeriodStart != "2025-09-25" {
			t.Errorf("PeriodStart = %s, want 2025-09-25", *rec.PeriodStart)
		}
		if rec.PeriodEnd == nil {
			t.Fatalf("PeriodEnd is nil")
		}
		if *rec.PeriodEnd != "2025-10-24" {
			t.Errorf("PeriodEnd = %s, want 2025-10-24", *rec.PeriodEnd)
		}
	})

	// Test with empty period dates
	t.Run("EmptyPeriodDates", func(t *testing.T) {
		stmt := &statement.Statement{
			Parser:        "alinma",
			ParserVersion: "1",
			Bank:          "alinma",
			AccountNumber: "12345000002",
			Currency:      "SAR",
			PeriodStart:   "",
			PeriodEnd:     "",
			Transactions:  []statement.Transaction{},
		}

		accountID, err := store.UpsertAccount(ctx, stmt.Bank, stmt.AccountNumber, stmt.IBAN)
		if err != nil {
			t.Fatalf("UpsertAccount: %v", err)
		}

		// Parse empty dates
		periodStart, err := ParseStatementDate(stmt.PeriodStart)
		if err != nil {
			t.Fatalf("ParseStatementDate empty PeriodStart: %v", err)
		}
		periodEnd, err := ParseStatementDate(stmt.PeriodEnd)
		if err != nil {
			t.Fatalf("ParseStatementDate empty PeriodEnd: %v", err)
		}

		// Verify they are zero times
		if !periodStart.IsZero() {
			t.Errorf("periodStart is not zero: %v", periodStart)
		}
		if !periodEnd.IsZero() {
			t.Errorf("periodEnd is not zero: %v", periodEnd)
		}

		// Insert into database
		importID, err := store.CreateImport(ctx, ImportInput{
			AccountID:      accountID,
			FileSHA256:     "fedcba0987654321fedcba0987654321fedcba0987654321fedcba0987654321",
			Parser:         stmt.Parser,
			ParserVersion:  stmt.ParserVersion,
			PeriodStart:    "",
			PeriodEnd:      "",
			RowCount:       0,
			Statement:      stmt,
			Reconciliation: statement.Reconciliation{OK: true},
			Accepted:       true,
		})
		if err != nil {
			t.Fatalf("CreateImport: %v", err)
		}

		// Read back and verify dates are NULL
		rec, err := store.ImportByID(ctx, importID)
		if err != nil {
			t.Fatalf("ImportByID: %v", err)
		}

		if rec.PeriodStart != nil {
			t.Errorf("PeriodStart = %v, want nil", *rec.PeriodStart)
		}
		if rec.PeriodEnd != nil {
			t.Errorf("PeriodEnd = %v, want nil", *rec.PeriodEnd)
		}
	})

	// Test invalid date format
	t.Run("InvalidDateFormat", func(t *testing.T) {
		stmt := &statement.Statement{
			Parser:        "alinma",
			ParserVersion: "1",
			Bank:          "alinma",
			AccountNumber: "12345000003",
			Currency:      "SAR",
			PeriodStart:   "invalid-date",
			PeriodEnd:     "2025/10/24",
			Transactions:  []statement.Transaction{},
		}

		_, err := ParseStatementDate(stmt.PeriodStart)
		if err == nil {
			t.Fatalf("ParseStatementDate should have failed for invalid date")
		}
		if !errors.Is(err, ErrInvalidDateFormat) {
			t.Errorf("Expected ErrInvalidDateFormat, got %v", err)
		}
	})
}

func int64Ptr(v int64) *int64 {
	return &v
}

func intPtr(v int) *int {
	return &v
}
