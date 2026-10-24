package importer

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/aliAljaffer/expense-tracker/parsers/alrajhi"
	"github.com/aliAljaffer/expense-tracker/parsers/alinma"
	"github.com/aliAljaffer/expense-tracker/parsers/statement"
)

// TestPreviewFixture generates and maintains the preview fixture file at
// web/test/fixtures/preview.json. It contains synthetic statements that
// match the expected API response structure for various scenarios: success,
// rejection, and already-imported cases, with and without anomaly analysis.
// Set UPDATE_FIXTURES=1 to regenerate the fixture; otherwise it fails if
// the output drifts.
func TestPreviewFixture(t *testing.T) {
	ctx := context.Background()
	store := testStore(t)
	svc := NewService(store)

	// Build synthetic statements
	alinmaXLSX := buildAlinmaXLSX()
	alinmaSt := mustParseAlinma(t, alinmaXLSX)
	normalizeDateFormat(alinmaSt)

	alrajhiPDF := buildAlrajhiPDF()
	alrajhiSt := mustParseAlrajhi(t, alrajhiPDF)
	normalizeDateFormat(alrajhiSt)

	rejectedXLSX := buildRejectedAlinmaXLSX()
	rejectedSt := mustParseAlinma(t, rejectedXLSX)
	normalizeDateFormat(rejectedSt)

	// Upload Alinma first to create history
	svc.parse = func([]byte) (*statement.Statement, error) { return alinmaSt, nil }
	alinmaFirstPreview, err := svc.Upload(ctx, alinmaXLSX)
	if err != nil {
		t.Fatalf("alinma first upload: %v", err)
	}
	// Commit to store transactions
	if _, err := svc.Commit(ctx, alinmaFirstPreview.ImportID, nil); err != nil {
		t.Fatalf("commit alinma: %v", err)
	}

	// Build a statement with some rows from Alinma to create duplicates
	alinmaWithDupsXLSX := buildAlinmaWithDuplicates()
	alinmaWithDupsSt := mustParseAlinma(t, alinmaWithDupsXLSX)
	normalizeDateFormat(alinmaWithDupsSt)

	// Upload the statement with duplicates (will have rows held for review)
	svc.parse = func([]byte) (*statement.Statement, error) { return alinmaWithDupsSt, nil }
	alinmaPreview, err := svc.Upload(ctx, alinmaWithDupsXLSX)
	if err != nil {
		t.Fatalf("alinma upload: %v", err)
	}
	if alinmaPreview.Status != "pending" {
		t.Fatalf("alinma preview status = %q; want pending", alinmaPreview.Status)
	}

	// Upload Al Rajhi (succeeds, gets anomaly analysis)
	svc.parse = func([]byte) (*statement.Statement, error) { return alrajhiSt, nil }
	alrajhiPreview, err := svc.Upload(ctx, alrajhiPDF)
	if err != nil {
		t.Fatalf("alrajhi upload: %v", err)
	}
	if alrajhiPreview.Status != "pending" {
		t.Fatalf("alrajhi preview status = %q; want pending", alrajhiPreview.Status)
	}

	// Upload rejected statement (fails reconciliation)
	svc.parse = func([]byte) (*statement.Statement, error) { return rejectedSt, nil }
	rejectedPreview, err := svc.Upload(ctx, rejectedXLSX)
	if err != nil {
		t.Fatalf("rejected upload: %v", err)
	}
	if rejectedPreview.Status != "rejected" {
		t.Fatalf("rejected preview status = %q; want rejected", rejectedPreview.Status)
	}

	// Upload the same Alinma file again to get already_imported variant
	svc.parse = func([]byte) (*statement.Statement, error) { return alinmaSt, nil }
	alreadyImportedPreview, err := svc.Upload(ctx, alinmaXLSX)
	if err != nil {
		t.Fatalf("already_imported upload: %v", err)
	}
	if !alreadyImportedPreview.AlreadyImported {
		t.Fatalf("already_imported = false; want true")
	}

	// Mask account numbers in all previews
	maskAccountNumber(alinmaPreview)
	maskAccountNumber(alrajhiPreview)
	maskAccountNumber(rejectedPreview)
	maskAccountNumber(alreadyImportedPreview)

	fixtures := map[string]interface{}{
		"alinma_ok":      alinmaPreview,
		"alrajhi_ok":     alrajhiPreview,
		"rejected":       rejectedPreview,
		"already_imported": alreadyImportedPreview,
	}

	fixtureFile := filepath.Join("../../web/test/fixtures/preview.json")
	os.MkdirAll(filepath.Dir(fixtureFile), 0755)

	if os.Getenv("UPDATE_FIXTURES") == "1" {
		data, err := json.MarshalIndent(fixtures, "", "  ")
		if err != nil {
			t.Fatalf("marshal: %v", err)
		}
		if err := os.WriteFile(fixtureFile, data, 0644); err != nil {
			t.Fatalf("write fixture: %v", err)
		}
		return
	}

	// Compare against fixture
	existingData, err := os.ReadFile(fixtureFile)
	if err != nil {
		if os.IsNotExist(err) {
			t.Fatalf("fixture file does not exist; run with UPDATE_FIXTURES=1 to generate it")
		}
		t.Fatalf("read fixture: %v", err)
	}

	var existing map[string]interface{}
	if err := json.Unmarshal(existingData, &existing); err != nil {
		t.Fatalf("parse fixture: %v", err)
	}

	// Deep comparison with human-readable diff on mismatch
	current, _ := json.MarshalIndent(fixtures, "", "  ")
	if !bytes.Equal(current, existingData) {
		// Print a short diff hint
		currentJSON := map[string]json.RawMessage{}
		existingJSON := map[string]json.RawMessage{}
		json.Unmarshal(current, &currentJSON)
		json.Unmarshal(existingData, &existingJSON)

		for key := range fixtures {
			if !bytes.Equal(currentJSON[key], existingJSON[key]) {
				t.Errorf("fixture %q drifted; regenerate with UPDATE_FIXTURES=1", key)
			}
		}
		t.Fail()
	}
}

func buildAlinmaXLSX() []byte {
	// Use the Alinma test fixture builder from alinma_test.go
	// Note: dates in the XLSX are in DD/MM/YYYY format
	rows := [][]string{
		{"Account Statement"},
		{"From[01/01/2026] To[31/01/2026]"},
		{"معلومات الحساب\n‫Customer Name", "SAMPLE CUSTOMER"},
		{"رقم الحساب\n‫Account Number", "12345000001"},
		{"العملة\n‫Account Currency", "SAR"},
		{"الرصيد الافتتاحي\n‫Opening Balance", "1,000.00"},
		{"الرصيد الختامي\n‫Closing Balance", "1,186.00"},
		{"عدد السحوبات\n‫Number of Withdraws", "12", "إجمالي السحوبات\n‫Total Withdraws", "624.00"},
		{"عدد الإيداعات\n‫Number Of Deposits", "3", "إجمالي الإيداعات\n‫Totals Deposits", "810.00"},
		{"التاريخ", "الوصف", "إيداع", "سحب", "الرصيد"},
		{"46027", "SAR 25.75 تم الشراء مع Apple Pay App بواسطة Mada Card *0630 في SAMPLE CO على 05-01-2026 في 10:00AM", "", "-25.75", "974.25"},
		{"46027", "SAR 25.75 purchase was made with Apple Pay App by Mada Card *0630 at SAMPLE CO On 05-01-2026 at 10:00AM", "", "-4.25", "970.00"},
		{"46028", "معاملة شراء عبر الإنترنت SAR من SAMPLE ONLINE في 06-01-2026", "", "-10.00", "960.00"},
		{"46029", "معاملة إعادة الشراء SAR من SAMPLE ONLINE في 07-01-2026", "10.00", "", "970.00"},
		{"46030", "رقم المرجع ATM123456 VISA - عملية شراء من نقاط البيع من الحساب ** 8000 for SAR 100.00 من SAMPLE INTL__ على 08-01-2026 SAMPLE LLC,USD 26.67 ID20260109 سعر الصرف 3.75 USD #26 2.50 العمولة", "", "-100.00", "870.00"},
		{"46031", "505 On 09-01-2026 at 08:27AM", "", "-50.00", "820.00"},
		{"46031", "SAR 50.00 purchase was made with Apple Pay App by Mada Card *0630 at SAMPLE TRUNC On 09-01-2026 at 08:27AM", "", "-1.00", "819.00"},
		{"46031", "حوالة داخلية إلى حساب SAMPLE", "", "-100.00", "719.00"},
		{"46031", "التحويل الوارد سريع المحول SAMPLE SENDER المبلغ 500.00", "500.00", "", "1,219.00"},
		{"46032", "حوالة صادرة ) SAMPLE BANK في مصرف آخر IBAN:SA0005000001234567890123)", "", "-20.00", "1,199.00"},
		{"46032", "إيداع نقدي في جهاز الصراف", "300.00", "", "1,499.00"},
		{"46032", "سحب نقدي من جهاز الصراف", "", "-100.00", "1,399.00"},
		{"46032", "سداد فاتورة SAMPLE UTILITY رقمها 1234567890", "", "-200.00", "1,199.00"},
		{"46032", "668513 1008", "", "-1.00", "1,198.00"},
		{"46032", "SAR 12.00 تم الشراء مع Apple Pay App بواسطة Mada Card *0630 في SAMPLE STORE #TRAD على 10-01-2026", "", "-12.00", "1,186.00"},
	}
	return buildXLSX(rows, false)
}

func buildAlinmaWithDuplicates() []byte {
	// Build a statement with some duplicate rows from the first statement
	rows := [][]string{
		{"Account Statement"},
		{"From[01/01/2026] To[31/01/2026]"},
		{"معلومات الحساب\n‫Customer Name", "SAMPLE CUSTOMER"},
		{"رقم الحساب\n‫Account Number", "12345000001"},
		{"العملة\n‫Account Currency", "SAR"},
		{"الرصيد الافتتاحي\n‫Opening Balance", "1,000.00"},
		{"الرصيد الختامي\n‫Closing Balance", "970.00"},
		{"عدد السحوبات\n‫Number of Withdraws", "2", "إجمالي السحوبات\n‫Total Withdraws", "30.00"},
		{"عدد الإيداعات\n‫Number Of Deposits", "0", "إجمالي الإيداعات\n‫Totals Deposits", "0.00"},
		{"التاريخ", "الوصف", "إيداع", "سحب", "الرصيد"},
		{"46027", "SAR 25.75 تم الشراء مع Apple Pay App بواسطة Mada Card *0630 في SAMPLE CO على 05-01-2026 في 10:00AM", "", "-25.75", "974.25"},
		{"46027", "SAR 25.75 purchase was made with Apple Pay App by Mada Card *0630 at SAMPLE CO On 05-01-2026 at 10:00AM", "", "-4.25", "970.00"},
	}
	return buildXLSX(rows, false)
}

func buildRejectedAlinmaXLSX() []byte {
	// Build a statement with mismatched totals
	rows := [][]string{
		{"Account Statement"},
		{"From[01/01/2026] To[31/01/2026]"},
		{"معلومات الحساب\n‫Customer Name", "SAMPLE CUSTOMER"},
		{"رقم الحساب\n‫Account Number", "00000000000003"},
		{"العملة\n‫Account Currency", "SAR"},
		{"الرصيد الافتتاحي\n‫Opening Balance", "1,000.00"},
		{"الرصيد الختامي\n‫Closing Balance", "1,186.00"},
		{"عدد السحوبات\n‫Number of Withdraws", "1", "إجمالي السحوبات\n‫Total Withdraws", "625.00"}, // Wrong total
		{"عدد الإيداعات\n‫Number Of Deposits", "1", "إجمالي الإيداعات\n‫Totals Deposits", "810.00"},
		{"التاريخ", "الوصف", "إيداع", "سحب", "الرصيد"},
		{"46027", "SAR 25.75 purchase", "", "-25.75", "974.25"},
		{"46029", "SAR 10.00 refund", "10.00", "", "984.25"},
	}
	return buildXLSX(rows, false)
}

func buildAlrajhiPDF() []byte {
	// Build a PDF by writing lines that parseLines expects
	// IBAN format: SA + check digits + bank code (80 for Al Rajhi) + account
	lines := []string{
		"Ref. No                                        55000001",
		"Customer Name                SAMPLE CUSTOMER                         ",
		"Account Number                   000000000001",
		"IBAN Number                 SA0080000001234567890123",
		"Opening Balance                        0.00 SAR",
		"Closing Balance                      445.67 SAR",
		"Number Of Deposits                         1",
		"Number Of Withdrawals                      6",
		"Total Deposits                     1,000.00 SAR",
		"Total Withdrawals                   554.33 SAR",
		"On The Period             2026/01/01        -         2026/03/31",

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

		"Credit Salary",
		"2026/01/09   Time:09:03:48, Notes:SAMPLE EMPLOYER",
		"                                                                      0.00 SAR  1,000.00 SAR    1,463.67 SAR",

		"Some New Type",
		"2026/01/10   Time:09:03:48, Notes:SOMETHING",
		"                                                                    5.00 SAR       0.00 SAR    1,458.67 SAR",

		"Debit - Credit Cards Transactions",
		"2026/01/11   Time:21:31:39, Notes:W - Advance payment for Card ending - 0000",
		"                                                                   13.00 SAR       0.00 SAR      445.67 SAR",
	}
	return buildPDFFromLines(lines)
}

// maskAccountNumber masks the account number in the preview for synthetic data safety
func maskAccountNumber(p *Preview) {
	// Account numbers are already masked by the API
	// but ensure they match the expected format
	if len(p.AccountNumber) > 4 {
		// Format: ****LAST4
		p.AccountNumber = "****" + p.AccountNumber[len(p.AccountNumber)-4:]
	}
}

func mustParseAlinma(t *testing.T, data []byte) *statement.Statement {
	t.Helper()
	s, err := alinma.Parse(data)
	if err != nil {
		t.Fatalf("parse alinma: %v", err)
	}
	return s
}

func mustParseAlrajhi(t *testing.T, data []byte) *statement.Statement {
	t.Helper()
	s, err := alrajhi.Parse(data)
	if err != nil {
		t.Fatalf("parse alrajhi: %v", err)
	}
	return s
}

// buildXLSX is copied from alinma_test.go to avoid dependencies on test packages
func buildXLSX(rows [][]string, inlineAll bool) []byte {
	var shared []string
	index := map[string]int{}
	sharedIndex := func(s string) int {
		if i, ok := index[s]; ok {
			return i
		}
		index[s] = len(shared)
		shared = append(shared, s)
		return index[s]
	}

	var sheet bytes.Buffer
	sheet.WriteString(`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>`)
	for r, row := range rows {
		fmt.Fprintf(&sheet, `<row r="%d">`, r+1)
		for c, value := range row {
			if value == "" {
				continue
			}
			ref := string(rune('A'+c)) + fmt.Sprint(r+1)
			switch {
			case inlineAll:
				fmt.Fprintf(&sheet, `<c r="%s" t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>`, ref, escapeXML(value))
			case isNumber(value):
				fmt.Fprintf(&sheet, `<c r="%s"><v>%s</v></c>`, ref, value)
			default:
				fmt.Fprintf(&sheet, `<c r="%s" t="s"><v>%d</v></c>`, ref, sharedIndex(value))
			}
		}
		sheet.WriteString(`</row>`)
	}
	sheet.WriteString(`</sheetData></worksheet>`)

	var sst bytes.Buffer
	sst.WriteString(`<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`)
	for _, s := range shared {
		fmt.Fprintf(&sst, `<si><t xml:space="preserve">%s</t></si>`, escapeXML(s))
	}
	sst.WriteString(`</sst>`)

	return buildXLSXZip(sheet.String(), sst.String())
}

func buildXLSXZip(sheetXML, sstXML string) []byte {
	var z bytes.Buffer
	zw := zip.NewWriter(&z)
	defer zw.Close()

	w, _ := zw.Create("xl/worksheets/sheet1.xml")
	w.Write([]byte(sheetXML))

	w, _ = zw.Create("xl/sharedStrings.xml")
	w.Write([]byte(sstXML))

	zw.Close()
	return z.Bytes()
}

func buildPDFFromLines(lines []string) []byte {
	var content strings.Builder
	y := 800.0
	for _, line := range lines {
		fmt.Fprintf(&content, "BT /F1 9 Tf 1 0 0 1 40 %.2f Tm (%s) Tj ET\n", y, pdfEscape(line))
		y -= 12
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

// normalizeDateFormat converts period dates to ISO format (YYYY-MM-DD)
// Alinma returns DD/MM/YYYY, Al Rajhi returns YYYY/MM/DD
func normalizeDateFormat(st *statement.Statement) {
	if st.PeriodStart != "" {
		st.PeriodStart = normalizeDate(st.PeriodStart)
	}
	if st.PeriodEnd != "" {
		st.PeriodEnd = normalizeDate(st.PeriodEnd)
	}
}

// normalizeDate converts DD/MM/YYYY or YYYY/MM/DD to YYYY-MM-DD
func normalizeDate(d string) string {
	parts := strings.Split(d, "/")
	if len(parts) != 3 {
		return d
	}

	// Try YYYY/MM/DD format first (Al Rajhi)
	if len(parts[0]) == 4 && parts[0] > "1900" {
		return fmt.Sprintf("%s-%s-%s", parts[0], parts[1], parts[2])
	}

	// Try DD/MM/YYYY format (Alinma)
	if len(parts[2]) == 4 {
		return fmt.Sprintf("%s-%s-%s", parts[2], parts[1], parts[0])
	}

	return d
}

func isNumber(s string) bool {
	for _, c := range s {
		if !((c >= '0' && c <= '9') || c == '.' || c == '-') {
			return false
		}
	}
	return true
}

func escapeXML(s string) string {
	// Simple XML escaping
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, `"`, "&quot;")
	s = strings.ReplaceAll(s, "'", "&apos;")
	return s
}

