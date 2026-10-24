package importer

import (
	"context"
	"testing"
)

// TestIntegrationAlinmaDateFormatRealStatement tests that a real Alinma statement
// with DD/MM/YYYY format dates is parsed and stored correctly without database errors.
func TestIntegrationAlinmaDateFormatRealStatement(t *testing.T) {
	store := testStore(t)
	svc := NewService(store)
	ctx := context.Background()

	alinmaXLSX := buildAlinmaXLSXWithErrorDate()
	preview, err := svc.Upload(ctx, alinmaXLSX)
	if err != nil {
		t.Fatalf("svc.Upload: %v", err)
	}

	if preview.PeriodStart != "2025-09-25" {
		t.Errorf("PeriodStart = %q, want 2025-09-25", preview.PeriodStart)
	}
	if preview.PeriodEnd != "2025-10-24" {
		t.Errorf("PeriodEnd = %q, want 2025-10-24", preview.PeriodEnd)
	}

	rec, err := store.ImportByID(ctx, preview.ImportID)
	if err != nil {
		t.Fatalf("ImportByID: %v", err)
	}

	if rec.PeriodStart == nil || *rec.PeriodStart != "2025-09-25" {
		t.Errorf("Stored PeriodStart = %v, want 2025-09-25", rec.PeriodStart)
	}
	if rec.PeriodEnd == nil || *rec.PeriodEnd != "2025-10-24" {
		t.Errorf("Stored PeriodEnd = %v, want 2025-10-24", rec.PeriodEnd)
	}
}

// TestIntegrationAlRahiDateFormatRealStatement tests that a real Al Rajhi statement
// with YYYY/MM/DD format dates is parsed and stored correctly without database errors.
func TestIntegrationAlRahiDateFormatRealStatement(t *testing.T) {
	store := testStore(t)
	svc := NewService(store)
	ctx := context.Background()

	alrajhiPDF := buildAlrajhiPDF()
	preview, err := svc.Upload(ctx, alrajhiPDF)
	if err != nil {
		t.Fatalf("svc.Upload: %v", err)
	}

	if preview.PeriodStart != "2026-01-01" {
		t.Errorf("PeriodStart = %q, want 2026-01-01", preview.PeriodStart)
	}
	if preview.PeriodEnd != "2026-03-31" {
		t.Errorf("PeriodEnd = %q, want 2026-03-31", preview.PeriodEnd)
	}

	rec, err := store.ImportByID(ctx, preview.ImportID)
	if err != nil {
		t.Fatalf("ImportByID: %v", err)
	}

	if rec.PeriodStart == nil || *rec.PeriodStart != "2026-01-01" {
		t.Errorf("Stored PeriodStart = %v, want 2026-01-01", rec.PeriodStart)
	}
	if rec.PeriodEnd == nil || *rec.PeriodEnd != "2026-03-31" {
		t.Errorf("Stored PeriodEnd = %v, want 2026-03-31", rec.PeriodEnd)
	}
}

func buildAlinmaXLSXWithErrorDate() []byte {
	rows := [][]string{
		{"Account Statement"},
		{"From[25/09/2025] To[24/10/2025]"},
		{"معلومات الحساب\n‫Customer Name", "TEST CUSTOMER"},
		{"رقم الحساب\n‫Account Number", "12345000001"},
		{"العملة\n‫Account Currency", "SAR"},
		{"الرصيد الافتتاحي\n‫Opening Balance", "1,000.00"},
		{"الرصيد الختامي\n‫Closing Balance", "1,186.00"},
		{"عدد السحوبات\n‫Number of Withdraws", "1", "إجمالي السحوبات\n‫Total Withdraws", "25.75"},
		{"عدد الإيداعات\n‫Number Of Deposits", "1", "إجمالي الإيداعات\n‫Totals Deposits", "211.00"},
		{"التاريخ", "الوصف", "إيداع", "سحب", "الرصيد"},
		{"46291", "Test transaction purchase", "", "-25.75", "974.25"},
		{"46292", "Test transaction refund", "211.00", "", "1186.00"},
	}
	return buildXLSX(rows, false)
}
