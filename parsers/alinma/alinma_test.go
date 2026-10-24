package alinma

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"testing"

	"github.com/aliAljaffer/grooszy/parsers/statement"
)

var bareNumber = regexp.MustCompile(`^-?\d+(\.\d+)?$`)

// buildXLSX writes a minimal workbook the way Excel does: numbers as plain
// values, text through the shared string table. inlineAll writes every cell as
// an inline string instead, the other encoding the exporter can produce.
func buildXLSX(t *testing.T, rows [][]string, inlineAll bool) []byte {
	t.Helper()
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

	var sheet strings.Builder
	sheet.WriteString(`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>`)
	for r, row := range rows {
		fmt.Fprintf(&sheet, `<row r="%d">`, r+1)
		for c, value := range row {
			if value == "" {
				continue
			}
			ref := string(rune('A'+c)) + strconv.Itoa(r+1)
			switch {
			case inlineAll:
				fmt.Fprintf(&sheet, `<c r="%s" t="inlineStr"><is><t xml:space="preserve">%s</t></is></c>`, ref, esc(value))
			case bareNumber.MatchString(value):
				fmt.Fprintf(&sheet, `<c r="%s"><v>%s</v></c>`, ref, value)
			default:
				fmt.Fprintf(&sheet, `<c r="%s" t="s"><v>%d</v></c>`, ref, sharedIndex(value))
			}
		}
		sheet.WriteString(`</row>`)
	}
	sheet.WriteString(`</sheetData></worksheet>`)

	var sst strings.Builder
	sst.WriteString(`<?xml version="1.0" encoding="UTF-8"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`)
	for _, s := range shared {
		fmt.Fprintf(&sst, `<si><t xml:space="preserve">%s</t></si>`, esc(s))
	}
	sst.WriteString(`</sst>`)

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	for name, body := range map[string]string{
		"xl/worksheets/sheet1.xml": sheet.String(),
		"xl/sharedStrings.xml":     sst.String(),
	} {
		w, err := zw.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := w.Write([]byte(body)); err != nil {
			t.Fatal(err)
		}
	}
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func esc(s string) string {
	var b strings.Builder
	if err := xml.EscapeText(&b, []byte(s)); err != nil {
		panic(err)
	}
	return b.String()
}

// fixtureRows is a synthetic statement: both scripts, every documented kind, a
// wrapped merchant name, a truncated purchase recovered from its sweep, an
// international purchase with a fee, and a row nothing can classify. The header
// figures reconcile with the rows to the halala.
func fixtureRows() [][]string {
	return [][]string{
		{"Account Statement"},
		{"From[01/01/2026] To[31/03/2026]"},
		{"معلومات الحساب\n\u202bCustomer Name", "SAMPLE CUSTOMER"},
		{"رقم الحساب\n\u202bAccount Number", "00000000000000"},
		{"العملة\n\u202bAccount Currency", "SAR"},
		{"الرصيد الافتتاحي\n\u202bOpening Balance", "1,000.00"},
		{"الرصيد الختامي\n\u202bClosing Balance", "1,186.00"},
		{"عدد السحوبات\n\u202bNumber of Withdraws", "12", "إجمالي السحوبات\n\u202bTotal Withdraws", "624.00"},
		{"عدد الإيداعات\n\u202bNumber Of Deposits", "3", "إجمالي الإيداعات\n\u202bTotals Deposits", "810.00"},
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
		{"46032", "حوالة صادرة ) SAMPLE BANK في مصرف آخر", "", "-20.00", "1,199.00"},
		{"46032", "إيداع نقدي في جهاز الصراف", "300.00", "", "1,499.00"},
		{"46032", "سحب نقدي من جهاز الصراف", "", "-100.00", "1,399.00"},
		{"46032", "سداد فاتورة SAMPLE UTILITY رقمها 1234567890", "", "-200.00", "1,199.00"},
		{"46032", "668513 1008", "", "-1.00", "1,198.00"},
		{"46032", "SAR 12.00 تم الشراء مع Apple Pay App بواسطة Mada Card *0630 في SAMPLE STORE #TRAD على 10-01-2026", "", "-12.00", "1,186.00"},
	}
}

func parseFixture(t *testing.T, inlineAll bool) *statement.Statement {
	t.Helper()
	s, err := Parse(buildXLSX(t, fixtureRows(), inlineAll))
	if err != nil {
		t.Fatal(err)
	}
	return s
}

func TestParseReconciles(t *testing.T) {
	for _, inlineAll := range []bool{false, true} {
		s := parseFixture(t, inlineAll)
		if r := s.Reconcile(); !r.OK {
			t.Fatalf("inline=%v: reconciliation failed: %+v", inlineAll, r.Checks)
		}
		if len(s.Transactions) != 15 {
			t.Fatalf("inline=%v: got %d transactions; want 15", inlineAll, len(s.Transactions))
		}
		if s.CustomerName != "SAMPLE CUSTOMER" || s.AccountNumber != "00000000000000" || s.Currency != "SAR" {
			t.Errorf("inline=%v: header identity: %+v", inlineAll, s)
		}
		if s.PeriodStart != "01/01/2026" || s.PeriodEnd != "31/03/2026" {
			t.Errorf("inline=%v: period %q..%q", inlineAll, s.PeriodStart, s.PeriodEnd)
		}
	}
}

func TestParseKindsAndMerchants(t *testing.T) {
	s := parseFixture(t, false)

	want := []struct {
		date     string
		kind     statement.Kind
		merchant string
		debit    int64
		credit   int64
	}{
		{"2026-01-05", statement.CardPurchase, "SAMPLE CO", 2575, 0},
		{"2026-01-05", statement.RoundupSweep, "SAMPLE CO", 425, 0},
		{"2026-01-06", statement.OnlinePurchase, "SAMPLE ONLINE", 1000, 0},
		{"2026-01-07", statement.Refund, "SAMPLE ONLINE", 0, 1000},
		{"2026-01-08", statement.IntlPurchase, "SAMPLE INTL", 10000, 0},
		{"2026-01-09", statement.CardPurchase, "SAMPLE TRUNC", 5000, 0},
		{"2026-01-09", statement.RoundupSweep, "SAMPLE TRUNC", 100, 0},
		{"2026-01-09", statement.InternalTransfer, "", 10000, 0},
		{"2026-01-09", statement.ExternalTransferIn, "SAMPLE SENDER", 0, 50000},
		{"2026-01-10", statement.ExternalTransferOut, "SAMPLE BANK", 2000, 0},
		{"2026-01-10", statement.CashDeposit, "", 0, 30000},
		{"2026-01-10", statement.CashWithdrawal, "", 10000, 0},
		{"2026-01-10", statement.BillPayment, "SAMPLE UTILITY", 20000, 0},
		{"2026-01-10", statement.Unknown, "", 100, 0},
		{"2026-01-10", statement.CardPurchase, "SAMPLE STORE TRAD", 1200, 0},
	}
	if len(s.Transactions) != len(want) {
		t.Fatalf("got %d transactions; want %d", len(s.Transactions), len(want))
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
}

func TestParseInternationalDetails(t *testing.T) {
	s := parseFixture(t, false)
	tx := s.Transactions[4]
	if tx.CardLast4 != "" {
		t.Errorf("intl row should not carry a card last4, got %q", tx.CardLast4)
	}
	if tx.FxCurrency != "USD" || tx.FxAmount == nil || *tx.FxAmount != 2667 {
		t.Errorf("fx currency/amount = %q %v", tx.FxCurrency, tx.FxAmount)
	}
	if tx.FxRate != "3.75" {
		t.Errorf("fx rate = %q", tx.FxRate)
	}
	if tx.FxFee == nil || *tx.FxFee != 250 {
		t.Errorf("fx fee = %v", tx.FxFee)
	}
	if last4 := s.Transactions[0].CardLast4; last4 != "0630" {
		t.Errorf("card purchase last4 = %q; want 0630", last4)
	}
	if acct := s.Transactions[12].BillerAccount; acct != "1234567890" {
		t.Errorf("biller account = %q", acct)
	}
}

func TestShortParseIsRejected(t *testing.T) {
	rows := fixtureRows()
	rows[7][3] = "624.01"
	s, err := Parse(buildXLSX(t, rows, false))
	if err != nil {
		t.Fatal(err)
	}
	r := s.Reconcile()
	if r.OK {
		t.Fatal("a mismatched header total must not reconcile")
	}
	for _, c := range r.Checks {
		if c.Name == "debit_total" && c.Status != statement.Fail {
			t.Errorf("debit_total = %s; want fail", c.Status)
		}
	}
}

func TestRejectsNotAWorkbook(t *testing.T) {
	if _, err := Parse([]byte("not a zip")); err == nil {
		t.Fatal("expected an error for a non-xlsx file")
	}
}

// The export repeats rows that share a serial, description and amount and only
// differ in balance, so both must land in Transactions and in the totals.
func TestParseKeepsRepeatedTransactions(t *testing.T) {
	rows := [][]string{
		{"Account Statement"},
		{"From[01/01/2026] To[31/03/2026]"},
		{"معلومات الحساب\n\u202bCustomer Name", "SAMPLE CUSTOMER"},
		{"رقم الحساب\n\u202bAccount Number", "00000000000000"},
		{"العملة\n\u202bAccount Currency", "SAR"},
		{"الرصيد الافتتاحي\n\u202bOpening Balance", "1,000.00"},
		{"الرصيد الختامي\n\u202bClosing Balance", "990.00"},
		{"عدد السحوبات\n\u202bNumber of Withdraws", "2", "إجمالي السحوبات\n\u202bTotal Withdraws", "10.00"},
		{"عدد الإيداعات\n\u202bNumber Of Deposits", "0", "إجمالي الإيداعات\n\u202bTotals Deposits", "0.00"},
		{"التاريخ", "الوصف", "إيداع", "سحب", "الرصيد"},
		{"46036", "SAR 5.00 تم الشراء مع Apple Pay App بواسطة Mada Card *0630 في SAMPLE TWIN على 14-01-2026 في 09:00AM", "", "-5.00", "995.00"},
		{"46036", "SAR 5.00 تم الشراء مع Apple Pay App بواسطة Mada Card *0630 في SAMPLE TWIN على 14-01-2026 في 09:00AM", "", "-5.00", "990.00"},
	}
	s, err := Parse(buildXLSX(t, rows, false))
	if err != nil {
		t.Fatal(err)
	}
	r := s.Reconcile()
	if !r.OK {
		t.Fatalf("reconciliation failed: %+v", r.Checks)
	}
	if r.DebitCount != 2 || r.DebitTotal != 1000 {
		t.Fatalf("reconciliation counted %d debits totalling %d; want both repeats", r.DebitCount, r.DebitTotal)
	}
	if len(s.Transactions) != 2 {
		t.Fatalf("got %d transactions; want 2, one per identical row", len(s.Transactions))
	}
	for i, tx := range s.Transactions {
		if tx.PostedDate != "2026-01-14" || tx.Kind != statement.CardPurchase ||
			tx.MerchantRaw != "SAMPLE TWIN" || tx.Debit != 500 {
			t.Errorf("row %d = %s %s %q debit=%d", i, tx.PostedDate, tx.Kind, tx.MerchantRaw, tx.Debit)
		}
	}
}

// The exporter sometimes truncates a purchase row to digits plus a timestamp,
// which leaves no merchant to extract. The row without a merchant must keep an
// empty MerchantRaw and the row after it must parse on its own.
func TestParseWithoutMerchant(t *testing.T) {
	rows := [][]string{
		{"Account Statement"},
		{"From[01/01/2026] To[31/03/2026]"},
		{"معلومات الحساب\n\u202bCustomer Name", "SAMPLE CUSTOMER"},
		{"رقم الحساب\n\u202bAccount Number", "00000000000000"},
		{"العملة\n\u202bAccount Currency", "SAR"},
		{"الرصيد الافتتاحي\n\u202bOpening Balance", "1,000.00"},
		{"الرصيد الختامي\n\u202bClosing Balance", "987.25"},
		{"عدد السحوبات\n\u202bNumber of Withdraws", "2", "إجمالي السحوبات\n\u202bTotal Withdraws", "12.75"},
		{"عدد الإيداعات\n\u202bNumber Of Deposits", "0", "إجمالي الإيداعات\n\u202bTotals Deposits", "0.00"},
		{"التاريخ", "الوصف", "إيداع", "سحب", "الرصيد"},
		{"46033", "33 On 11-01-2026 at 08:00AM", "", "-3.75", "996.25"},
		{"46034", "SAR 9.00 تم الشراء مع Apple Pay App بواسطة Mada Card *0630 في SAMPLE CO على 12-01-2026 في 09:00AM", "", "-9.00", "987.25"},
	}
	s, err := Parse(buildXLSX(t, rows, false))
	if err != nil {
		t.Fatal(err)
	}
	if r := s.Reconcile(); !r.OK {
		t.Fatalf("reconciliation failed: %+v", r.Checks)
	}
	if len(s.Transactions) != 2 {
		t.Fatalf("got %d transactions; want 2, the merchant-less row and the row after it", len(s.Transactions))
	}
	empty := s.Transactions[0]
	if empty.PostedDate != "2026-01-11" || empty.Kind != statement.CardPurchase ||
		empty.MerchantRaw != "" || empty.Debit != 375 {
		t.Errorf("no-merchant row = %s %s %q debit=%d", empty.PostedDate, empty.Kind, empty.MerchantRaw, empty.Debit)
	}
	next := s.Transactions[1]
	if next.PostedDate != "2026-01-12" || next.Kind != statement.CardPurchase ||
		next.MerchantRaw != "SAMPLE CO" || next.Debit != 900 {
		t.Errorf("row after = %s %s %q debit=%d", next.PostedDate, next.Kind, next.MerchantRaw, next.Debit)
	}
}
