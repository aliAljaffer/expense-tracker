package alrajhi

import (
	"bytes"
	"fmt"
	"strings"
	"testing"

	"github.com/aliAljaffer/expense-tracker/parsers/statement"
)

func headerLines() []string {
	return []string{
		"Ref. No                                        55000001",
		"Customer Name                SAMPLE CUSTOMER                         ",
		"Account Number                   000000000000000",
		"IBAN Number                 SA0000000000000000000000",
		"Opening Balance                        0.00 SAR",
		"Closing Balance                      445.67 SAR",
		"Number Of Deposits                         1",
		"Number Of Withdrawals                      6",
		"Total Deposits                     1,000.00 SAR",
		"Total Withdrawals                   554.33 SAR",
		"On The Period             2026/01/01        -         2026/03/31",
	}
}

// fixtureLines is the reference layout: amounts either on their own line below
// the date or at the right of the date line, with the merchant wrapping onto
// the line after the amounts.
func fixtureLines() []string {
	salary := []string{
		"Credit Salary",
		"2026/01/09   Time:09:03:48, Notes:SAMPLE EMPLOYER",
		"                                                                      0.00 SAR  1,000.00 SAR    1,463.67 SAR",
	}
	lines := append(headerLines(),
		"POS purchase Apple pay (Domestic)",
		"2026/01/05   Time:10:00:00, Notes:(1234567890123456-123456789012) SAMPLE STORE",
		"                                                                 25.75 SAR       0.00 SAR      974.25 SAR",
		"TRADING, ANY CITY, SA",

		"Online purchase Apple pay (Domestic)",
		"2026/01/06   Time:10:00:00, Notes:Online Purchase from SAMPLE ONLINE     10.00 SAR       0.00 SAR      964.25 SAR",

		"Sadad Payments",
		"2026/01/07   Time:09:02:51, Notes:W#153-4000000001 -10000000001",
		"                                                                  500.00 SAR       0.00 SAR      464.25 SAR",

		"Outward IPS Credit Transaction Charges",
		"2026/01/08   Time:09:03:48, Notes:9000000000000001/SAMPLE CUSTOMER",
		"                                                                    0.58 SAR       0.00 SAR      463.67 SAR",
	)
	lines = append(lines, salary...)
	lines = append(lines, salary...)
	lines = append(lines,
		"Some New Type",
		"2026/01/10   Time:09:03:48, Notes:SOMETHING",
		"                                                                    5.00 SAR       0.00 SAR    1,458.67 SAR",

		"Debit - Credit Cards Transactions",
		"2026/01/11   Time:21:31:39, Notes:W - Advance payment for Card ending - 0000",
		"                                                                   13.00 SAR       0.00 SAR      445.67 SAR",
	)
	return lines
}

func TestParseLines(t *testing.T) {
	s := parseLines(fixtureLines())
	r := s.Reconcile()
	if !r.OK {
		t.Fatalf("reconciliation failed: %+v", r.Checks)
	}
	if len(s.Transactions) != 7 {
		t.Fatalf("got %d transactions; want 7 (the repeated salary row is one row)", len(s.Transactions))
	}
	if s.Bank != "" {
		t.Errorf("bank = %q; the synthetic IBAN has no bank code", s.Bank)
	}
	if s.CustomerName != "SAMPLE CUSTOMER" || s.AccountNumber != "000000000000000" {
		t.Errorf("header identity: %+v", s)
	}
	if s.PeriodStart != "2026/01/01" || s.PeriodEnd != "2026/03/31" {
		t.Errorf("period = %q..%q", s.PeriodStart, s.PeriodEnd)
	}

	want := []struct {
		date     string
		kind     statement.Kind
		merchant string
		debit    int64
		credit   int64
	}{
		{"2026-01-05", statement.CardPurchase, "SAMPLE STORE TRADING", 2575, 0},
		{"2026-01-06", statement.OnlinePurchase, "SAMPLE ONLINE", 1000, 0},
		{"2026-01-07", statement.BillPayment, "", 50000, 0},
		{"2026-01-08", statement.Fee, "", 58, 0},
		{"2026-01-09", statement.Salary, "", 0, 100000},
		{"2026-01-10", statement.Unknown, "", 500, 0},
		{"2026-01-11", statement.CardPayment, "", 1300, 0},
	}
	for i, w := range want {
		got := s.Transactions[i]
		if got.PostedDate != w.date || got.Kind != w.kind || got.MerchantRaw != w.merchant ||
			got.Debit != w.debit || got.Credit != w.credit {
			t.Errorf("row %d = %s %s %q debit=%d credit=%d; want %s %s %q debit=%d credit=%d",
				i, got.PostedDate, got.Kind, got.MerchantRaw, got.Debit, got.Credit,
				w.date, w.kind, w.merchant, w.debit, w.credit)
		}
	}

	if tx := s.Transactions[2]; tx.BillerCode != "153" || tx.BillerAccount != "10000000001" {
		t.Errorf("sadad = %q/%q", tx.BillerCode, tx.BillerAccount)
	}
	if tx := s.Transactions[6]; tx.CardLast4 != "0000" {
		t.Errorf("card last4 = %q", tx.CardLast4)
	}
}

func TestParseLinesRejectsMismatch(t *testing.T) {
	lines := fixtureLines()
	lines[9] = "Total Withdrawals                   554.34 SAR"
	s := parseLines(lines)
	if s.Reconcile().OK {
		t.Fatal("a mismatched total must not reconcile")
	}
}

func TestParseLinesNeedsADate(t *testing.T) {
	s := parseLines([]string{
		"Sadad Payments",
		"                                                                  500.00 SAR       0.00 SAR      464.25 SAR",
	})
	if len(s.Transactions) != 0 {
		t.Fatalf("got %d rows without a date; want 0", len(s.Transactions))
	}
}

// --- PDF extraction ---

type run struct {
	x    float64
	text string
}

// buildPDF writes a single page with Courier text placed by text matrix. The
// extractor reads positions, not content-stream order, so this is enough to
// exercise it end to end.
func buildPDF(lines [][]run) []byte {
	var content strings.Builder
	for i, line := range lines {
		y := 800 - float64(i)*12
		for _, r := range line {
			fmt.Fprintf(&content, "BT /F1 9 Tf 1 0 0 1 %.2f %.2f Tm (%s) Tj ET\n", r.x, y, pdfEscape(r.text))
		}
	}

	var buf bytes.Buffer
	buf.WriteString("%PDF-1.4\n")
	offsets := make([]int, 6)
	add := func(n int, body string) {
		offsets[n] = buf.Len()
		fmt.Fprintf(&buf, "%d 0 obj\n%s\nendobj\n", n, body)
	}
	add(1, "<</Type/Catalog/Pages 2 0 R>>")
	add(2, "<</Type/Pages/Kids[3 0 R]/Count 1>>")
	add(3, "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>")
	add(4, "<</Type/Font/Subtype/Type1/BaseFont/Courier/Encoding/WinAnsiEncoding>>")
	offsets[5] = buf.Len()
	fmt.Fprintf(&buf, "5 0 obj\n<</Length %d>>\nstream\n%sendstream\nendobj\n", content.Len(), content.String())

	xref := buf.Len()
	buf.WriteString("xref\n0 6\n0000000000 65535 f \n")
	for i := 1; i <= 5; i++ {
		fmt.Fprintf(&buf, "%010d 00000 n \n", offsets[i])
	}
	fmt.Fprintf(&buf, "trailer\n<</Size 6/Root 1 0 R>>\nstartxref\n%d\n%%%%EOF\n", xref)
	return buf.Bytes()
}

func pdfEscape(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, "(", `\(`)
	return strings.ReplaceAll(s, ")", `\)`)
}

func TestExtractAndParse(t *testing.T) {
	pdf := buildPDF([][]run{
		{{40, "Ref. No 55000001"}},
		{{40, "Customer Name"}, {120, "SAMPLE CUSTOMER"}},
		{{40, "Account Number"}, {120, "000000000000000"}},
		{{40, "IBAN Number"}, {120, "SA0000000000000000000000"}},
		{{40, "Opening Balance"}, {120, "0.00 SAR"}},
		{{40, "Closing Balance"}, {120, "-35.75 SAR"}},
		{{40, "Number Of Deposits"}, {120, "0"}},
		{{40, "Number Of Withdrawals"}, {120, "1"}},
		{{40, "Total Deposits"}, {120, "0.00 SAR"}},
		{{40, "Total Withdrawals"}, {120, "35.75 SAR"}},
		{{40, "On The Period"}, {120, "2026/01/01"}, {220, "2026/03/31"}},
		{{40, "POS purchase Apple pay (Domestic)"}},
		{{40, "2026/01/05"}, {100, "Time:10:00:00, Notes:(1234567890123456-123456789012) SAMPLE STORE"}, {400, "35.75 SAR"}, {460, "0.00 SAR"}, {520, "964.25 SAR"}},
		{{40, "TRADING, ANY CITY, SA"}},
	})

	lines, err := extractLines(pdf)
	if err != nil {
		t.Fatal(err)
	}
	joined := strings.Join(lines, "\n")
	for _, want := range []string{"SAMPLE CUSTOMER", "SAMPLE STORE", "35.75 SAR"} {
		if !strings.Contains(joined, want) {
			t.Fatalf("extracted text is missing %q:\n%s", want, joined)
		}
	}

	s := parseLines(lines)
	if r := s.Reconcile(); !r.OK {
		t.Fatalf("reconciliation failed: %+v\n%s", r.Checks, joined)
	}
	if len(s.Transactions) != 1 {
		t.Fatalf("got %d transactions; want 1", len(s.Transactions))
	}
	if got := s.Transactions[0].MerchantRaw; got != "SAMPLE STORE TRADING" {
		t.Errorf("merchant = %q", got)
	}
}
