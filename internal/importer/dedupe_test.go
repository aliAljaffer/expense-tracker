package importer

import (
	"testing"
	"time"

	"github.com/aliAljaffer/expense-tracker/parsers/statement"
)

func date(t *testing.T, s string) time.Time {
	t.Helper()
	d, err := time.Parse(time.DateOnly, s)
	if err != nil {
		t.Fatal(err)
	}
	return d
}

func row(t *testing.T, account int64, posted string, debit int64, merchant, description string) Row {
	t.Helper()
	tr := statement.Transaction{
		PostedDate:     posted,
		DescriptionRaw: description,
		Debit:          debit,
		Kind:           statement.CardPurchase,
		MerchantRaw:    merchant,
	}
	fp, err := Fingerprint(account, tr)
	if err != nil {
		t.Fatal(err)
	}
	return Row{Transaction: tr, Fingerprint: fp}
}

func history(t *testing.T, account int64, id int64, posted string, debit int64, merchant, description string) HistoryRow {
	t.Helper()
	r := row(t, account, posted, debit, merchant, description)
	return HistoryRow{
		ID: id, PostedDate: date(t, posted), Debit: debit, Kind: string(statement.CardPurchase),
		MerchantRaw: merchant, DescriptionRaw: description, Fingerprint: r.Fingerprint,
	}
}

func TestExactFingerprintIsAlreadyImported(t *testing.T) {
	r := row(t, 1, "2026-01-05", 2575, "SAMPLE CO", "card purchase")
	rows := []Row{r}
	Analyse(rows, []HistoryRow{history(t, 1, 42, "2026-01-05", 2575, "SAMPLE CO", "card purchase")})
	d := rows[0].Duplicate
	if d == nil || !d.Exact || d.Score != 10 {
		t.Fatalf("duplicate = %+v, want exact 10", d)
	}
	if len(d.Matches) != 1 || d.Matches[0] != 42 {
		t.Fatalf("matches = %v, want [42]", d.Matches)
	}
	if got := len((&Preview{Rows: rows}).DefaultSelection()); got != 0 {
		t.Fatalf("default selection = %d rows, want 0", got)
	}
}

func TestRepeatedPurchaseAtSameMerchantIsNotDropped(t *testing.T) {
	rows := []Row{row(t, 1, "2026-01-10", 2500, "SAMPLE COFFEE", "card purchase")}
	Analyse(rows, []HistoryRow{history(t, 1, 7, "2026-01-05", 2500, "SAMPLE COFFEE", "card purchase")})
	if rows[0].Duplicate != nil {
		t.Fatalf("duplicate = %+v, want none five days apart", rows[0].Duplicate)
	}
}

func TestSameAmountSameDaySameMerchantIsHeld(t *testing.T) {
	rows := []Row{row(t, 1, "2026-01-05", 2500, "SAMPLE COFFEE", "card purchase")}
	Analyse(rows, []HistoryRow{history(t, 1, 7, "2026-01-05", 2500, "SAMPLE COFFEE", "card purchase old")})
	d := rows[0].Duplicate
	if d == nil || d.Exact {
		t.Fatalf("duplicate = %+v, want a scored match", d)
	}
	if d.Score < reviewThreshold {
		t.Fatalf("score = %d, want >= %d", d.Score, reviewThreshold)
	}
	if got := len((&Preview{Rows: rows}).DefaultSelection()); got != 0 {
		t.Fatalf("default selection = %d rows, want 0", got)
	}
}

func TestSameAmountDifferentMerchantIsNotHeld(t *testing.T) {
	rows := []Row{row(t, 1, "2026-01-05", 2500, "SAMPLE SHOP", "card purchase")}
	Analyse(rows, []HistoryRow{history(t, 1, 7, "2026-01-05", 2500, "OTHER SHOP", "card purchase old")})
	if d := rows[0].Duplicate; d == nil || d.Score >= reviewThreshold {
		t.Fatalf("duplicate = %+v, want a score below %d", d, reviewThreshold)
	}
}

func TestRowRepeatedInsideOneStatement(t *testing.T) {
	r := row(t, 1, "2026-01-05", 2500, "SAMPLE CO", "card purchase")
	rows := []Row{r, r}
	Analyse(rows, nil)
	if rows[0].Duplicate != nil {
		t.Fatalf("first row = %+v, want none", rows[0].Duplicate)
	}
	if d := rows[1].Duplicate; d == nil || !d.Exact {
		t.Fatalf("second row = %+v, want exact", d)
	}
}

func TestAnomalyNeedsHistory(t *testing.T) {
	rows := []Row{row(t, 1, "2026-01-05", 500000, "NEW MERCHANT", "card purchase")}
	stats := Analyse(rows, nil)
	if stats.AnomalyReady {
		t.Fatal("anomaly ready without history")
	}
	if rows[0].Anomaly != nil {
		t.Fatalf("anomaly = %+v, want none without history", rows[0].Anomaly)
	}
}

func TestAnomalyFlagsNewMerchantAndLargeAmount(t *testing.T) {
	var hist []HistoryRow
	for i := 0; i < 24; i++ {
		hist = append(hist, history(t, 1, int64(i+1), "2025-12-01", 1000, "KNOWN SHOP", "card purchase"))
	}
	rows := []Row{row(t, 1, "2026-01-05", 9000, "NEW MERCHANT", "card purchase")}
	stats := Analyse(rows, hist)
	if !stats.AnomalyReady {
		t.Fatal("anomaly not ready with 24 rows")
	}
	a := rows[0].Anomaly
	if a == nil || a.Score < reviewThreshold {
		t.Fatalf("anomaly = %+v, want a held score", a)
	}
}

func TestAnomalyIgnoresKnownMerchantAtUsualAmount(t *testing.T) {
	var hist []HistoryRow
	for i := 0; i < 24; i++ {
		hist = append(hist, history(t, 1, int64(i+1), "2025-12-01", 1000, "KNOWN SHOP", "card purchase"))
	}
	rows := []Row{row(t, 1, "2026-01-05", 1200, "KNOWN SHOP", "card purchase")}
	Analyse(rows, hist)
	if rows[0].Anomaly != nil {
		t.Fatalf("anomaly = %+v, want none", rows[0].Anomaly)
	}
}
