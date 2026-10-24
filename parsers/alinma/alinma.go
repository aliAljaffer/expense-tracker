// Package alinma parses an Alinma "Brief Statement of Account" XLSX export.
//
// The workbook is read with the standard archive and XML packages. Rows are
// kept even when they cannot be classified: dropping one breaks reconciliation
// and hides the gap.
package alinma

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/aliAljaffer/grooszy/parsers/statement"
)

// Version changes whenever parsed output changes. Imports store it.
const Version = "1"

// The trailing row repeats the closing balance in the date column, so any
// serial below this is not a transaction date.
const minSerial = 40000

var excelEpoch = time.Date(1899, 12, 30, 0, 0, 0, 0, time.UTC)

type richText struct {
	Text string `xml:"t"`
	Runs []struct {
		Text string `xml:"t"`
	} `xml:"r"`
}

func (r richText) String() string {
	if len(r.Runs) == 0 {
		return r.Text
	}
	var b strings.Builder
	for _, run := range r.Runs {
		b.WriteString(run.Text)
	}
	return b.String()
}

type xCell struct {
	Ref  string   `xml:"r,attr"`
	Type string   `xml:"t,attr"`
	V    string   `xml:"v"`
	IS   richText `xml:"is"`
}

type xRow struct {
	Cells []xCell `xml:"c"`
}

func readGrid(data []byte) ([][]string, error) {
	z, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("open xlsx: %w", err)
	}
	files := make(map[string]*zip.File, len(z.File))
	for _, f := range z.File {
		files[f.Name] = f
	}

	var shared []string
	if f := files["xl/sharedStrings.xml"]; f != nil {
		var sst struct {
			SI []richText `xml:"si"`
		}
		if err := decodeZip(f, &sst); err != nil {
			return nil, fmt.Errorf("read shared strings: %w", err)
		}
		for _, si := range sst.SI {
			shared = append(shared, si.String())
		}
	}

	sheet := files["xl/worksheets/sheet1.xml"]
	if sheet == nil {
		return nil, errors.New("xlsx has no xl/worksheets/sheet1.xml")
	}
	var doc struct {
		Rows []xRow `xml:"sheetData>row"`
	}
	if err := decodeZip(sheet, &doc); err != nil {
		return nil, fmt.Errorf("read sheet: %w", err)
	}

	var grid [][]string
	for _, row := range doc.Rows {
		cells := map[int]string{}
		max := -1
		for _, c := range row.Cells {
			i := colIndex(c.Ref)
			if i < 0 {
				continue
			}
			cells[i] = c.value(shared)
			if i > max {
				max = i
			}
		}
		if max < 0 {
			continue
		}
		line := make([]string, max+1)
		for i := range line {
			line[i] = cells[i]
		}
		grid = append(grid, line)
	}
	return grid, nil
}

func decodeZip(f *zip.File, v any) error {
	r, err := f.Open()
	if err != nil {
		return err
	}
	defer r.Close()
	return xml.NewDecoder(r).Decode(v)
}

func (c xCell) value(shared []string) string {
	switch c.Type {
	case "inlineStr":
		return c.IS.String()
	case "s":
		i, err := strconv.Atoi(strings.TrimSpace(c.V))
		if err != nil || i < 0 || i >= len(shared) {
			return ""
		}
		return shared[i]
	default:
		return c.V
	}
}

func colIndex(ref string) int {
	n := 0
	for _, c := range ref {
		if c < 'A' || c > 'Z' {
			break
		}
		n = n*26 + int(c-'A'+1)
	}
	return n - 1
}

var periodRE = regexp.MustCompile(`From\[([\d/]+)\]\s*To\[([\d/]+)\]`)

// parseHeader reads the six figures and the identity fields. Label cells hold
// the Arabic name, a newline, then the English one, prefixed with a
// right-to-left embedding mark.
func parseHeader(rows [][]string, s *statement.Statement) {
	labels := map[string]string{
		"Customer Name":       "customer_name",
		"Account Number":      "account_number",
		"Account Currency":    "currency",
		"Opening Balance":     "opening_balance",
		"Closing Balance":     "closing_balance",
		"Number of Withdraws": "stated_debit_count",
		"Total Withdraws":     "stated_debit_total",
		"Number Of Deposits":  "stated_credit_count",
		"Totals Deposits":     "stated_credit_total",
	}
	for i, row := range rows {
		if i >= 10 {
			break
		}
		for j, cell := range row {
			parts := strings.Split(cell, "\n")
			label := strings.Trim(strings.TrimSpace(parts[len(parts)-1]), "\u202a\u202b\u202c")
			if attr, ok := labels[label]; ok && j+1 < len(row) {
				raw := row[j+1]
				switch attr {
				case "customer_name":
					s.CustomerName = strings.TrimSpace(raw)
				case "account_number":
					s.AccountNumber = strings.TrimSpace(raw)
				case "currency":
					s.Currency = strings.TrimSpace(raw)
				case "opening_balance":
					s.OpeningBalance = amountPtr(raw)
				case "closing_balance":
					s.ClosingBalance = amountPtr(raw)
				case "stated_debit_total":
					s.StatedDebitTotal = amountPtr(raw)
				case "stated_credit_total":
					s.StatedCreditTotal = amountPtr(raw)
				case "stated_debit_count":
					s.StatedDebitCount = countPtr(raw)
				case "stated_credit_count":
					s.StatedCreditCount = countPtr(raw)
				}
			}
			if m := periodRE.FindStringSubmatch(cell); m != nil {
				s.PeriodStart, s.PeriodEnd = m[1], m[2]
			}
		}
	}
}

func amountPtr(raw string) *int64 {
	v, ok := statement.ParseAmount(raw)
	if !ok {
		return nil
	}
	return &v
}

func countPtr(raw string) *int {
	v, ok := statement.ParseAmount(raw)
	if !ok {
		return nil
	}
	n := int(v / 100)
	return &n
}

var (
	sweepMarkers = []string{
		"purchase was made with",
		"Internet Purchase Transaction from account",
		"Purchase from account",
	}
	// The card format states the amount before the verb, the internet format
	// after the account number.
	statedCard   = regexp.MustCompile(`^SAR\s*([\d,]+(?:\.\d+)?)\s`)
	statedOnline = regexp.MustCompile(`account \*+ ?\d+ ([\d,]+(?:\.\d+)?) SAR (?:from|in)`)
	// The exporter sometimes truncates the Arabic purchase row to the trailing
	// digits of the merchant name plus the timestamp.
	truncated     = regexp.MustCompile(`^(\d+) On \d{2}-\d{2}-\d{4} at`)
	sweepMerchant = regexp.MustCompile(`(?:at|from)\s+(.+?)\s+(?:On|in)\s+\d{2}-\d{2}-\d{4}`)

	cardPurchaseRE   = regexp.MustCompile(`Card \*(\d+) في (.+?) على \d{2}-\d{2}-\d{4}`)
	onlinePurchaseRE = regexp.MustCompile(`SAR من (.+?) في \d{2}-\d{2}-\d{4}`)
	cardFromAcctRE   = regexp.MustCompile(`SAR من (.+?) (?:في|على) \d{2}-\d{2}-\d{4}`)
	inwardNameRE     = regexp.MustCompile(`المحول (.+?) المبلغ`)
	outwardNameRE    = regexp.MustCompile(`\) ([A-Z][A-Za-z ]+?) في مصرف`)
	outwardIBANRE    = regexp.MustCompile(`IBAN:(\w+)\)`)
	billRE           = regexp.MustCompile(`سداد فاتورة (.+?) رقمها (\d+)`)
	fxFeeRE          = regexp.MustCompile(`([\d.]+) العمولة`)
	fxCurrencyRE     = regexp.MustCompile(`(USD|EUR|GBP|AED|SAR) ([\d.]+) ID`)
	fxRateRE         = regexp.MustCompile(`سعر الصرف ([\d.]+)`)
)

func clean(desc string) string {
	return strings.Join(strings.Fields(strings.ReplaceAll(desc, "#", " ")), " ")
}

func statedAmount(desc string) (int64, bool) {
	if m := statedCard.FindStringSubmatch(desc); m != nil {
		return statement.ParseAmount(m[1])
	}
	if m := statedOnline.FindStringSubmatch(desc); m != nil {
		return statement.ParseAmount(m[1])
	}
	return 0, false
}

func classify(t *statement.Transaction) {
	d := t.DescriptionRaw

	// An English-first row is always the round-up savings sweep; the Arabic row
	// beside it carries the purchase. Do not compare the stated amount to the
	// debit: a purchase ending in .50 sweeps exactly its own value.
	for _, marker := range sweepMarkers {
		if strings.Contains(d, marker) {
			t.Kind = statement.RoundupSweep
			if m := sweepMerchant.FindStringSubmatch(d); m != nil {
				t.MerchantRaw = m[1]
			}
			return
		}
	}

	if truncated.MatchString(d) {
		t.Kind = statement.CardPurchase
		return
	}

	switch {
	case strings.Contains(d, "تم الشراء"):
		t.Kind = statement.CardPurchase
		if m := cardPurchaseRE.FindStringSubmatch(d); m != nil {
			t.CardLast4, t.MerchantRaw = m[1], m[2]
		}
		return
	case strings.Contains(d, "معاملة شراء عبر الإنترنت"):
		t.Kind = statement.OnlinePurchase
		if m := onlinePurchaseRE.FindStringSubmatch(d); m != nil {
			t.MerchantRaw = m[1]
		}
		return
	case strings.Contains(d, "معاملة إعادة الشراء"):
		t.Kind = statement.Refund
		if m := onlinePurchaseRE.FindStringSubmatch(d); m != nil {
			t.MerchantRaw = m[1]
		}
		return
	}

	if strings.Contains(d, "VISA - عملية شراء") || strings.Contains(d, "رقم المرجع ATM") {
		t.Kind = statement.IntlPurchase
		// Anchor on the last ' من ' before '__ على'; the first one matches the
		// account prefix and yields the literal text "نقاط البيع من الحساب".
		if i := strings.Index(d, "__ على"); i > 0 {
			seg := d[:i]
			if j := strings.LastIndex(seg, " من "); j > 0 {
				t.MerchantRaw = strings.TrimSpace(seg[j+len(" من "):])
			} else {
				t.MerchantRaw = strings.TrimSpace(seg)
			}
		}
		if m := fxFeeRE.FindStringSubmatch(d); m != nil {
			if v, ok := statement.ParseAmount(m[1]); ok {
				t.FxFee = &v
			}
		}
		if m := fxCurrencyRE.FindStringSubmatch(d); m != nil {
			t.FxCurrency = m[1]
			if v, ok := statement.ParseAmount(m[2]); ok {
				t.FxAmount = &v
			}
		}
		if m := fxRateRE.FindStringSubmatch(d); m != nil {
			t.FxRate = m[1]
		}
		return
	}

	switch {
	case strings.Contains(d, "الشراء من الحساب"):
		t.Kind = statement.CardPurchase
		if m := cardFromAcctRE.FindStringSubmatch(d); m != nil {
			t.MerchantRaw = m[1]
		}
	case strings.Contains(d, "حوالة داخلية"):
		t.Kind = statement.InternalTransfer
	case strings.Contains(d, "التحويل الوارد سريع"):
		t.Kind = statement.ExternalTransferIn
		if m := inwardNameRE.FindStringSubmatch(d); m != nil {
			t.MerchantRaw = strings.TrimSpace(m[1])
		}
	case strings.Contains(d, "حوالة صادرة"):
		t.Kind = statement.ExternalTransferOut
		if m := outwardNameRE.FindStringSubmatch(d); m != nil {
			t.MerchantRaw = strings.TrimSpace(m[1])
		} else if m := outwardIBANRE.FindStringSubmatch(d); m != nil {
			t.MerchantRaw = strings.TrimSpace(m[1])
		}
	case strings.Contains(d, "إيداع نقدي"):
		t.Kind = statement.CashDeposit
	case strings.Contains(d, "سحب نقدي"):
		t.Kind = statement.CashWithdrawal
	case strings.Contains(d, "سداد فاتورة"):
		t.Kind = statement.BillPayment
		if m := billRE.FindStringSubmatch(d); m != nil {
			t.MerchantRaw = strings.TrimSpace(m[1])
			t.BillerAccount = m[2]
		}
	}
}

// Parse reads an Alinma XLSX export. It does not decide whether the statement
// is trustworthy; call Reconcile on the result and refuse when it fails.
func Parse(data []byte) (*statement.Statement, error) {
	rows, err := readGrid(data)
	if err != nil {
		return nil, err
	}
	s := &statement.Statement{
		Parser:        "alinma",
		ParserVersion: Version,
		Currency:      "SAR",
	}
	parseHeader(rows, s)
	s.Bank = statement.BankFromIBAN(s.IBAN)
	if s.Bank == "" {
		s.Bank = "Alinma"
	}

	for _, row := range rows {
		if len(row) == 0 || row[0] == "" {
			continue
		}
		serial, err := strconv.ParseFloat(strings.ReplaceAll(row[0], ",", ""), 64)
		if err != nil || serial < minSerial {
			continue
		}
		for len(row) < 5 {
			row = append(row, "")
		}

		credit, _ := statement.ParseAmount(row[2])
		debit, _ := statement.ParseAmount(row[3])
		t := statement.Transaction{
			Kind:           statement.Unknown,
			PostedDate:     excelEpoch.AddDate(0, 0, int(serial)).Format("2006-01-02"),
			DescriptionRaw: clean(row[1]),
			Debit:          abs(debit),
			Credit:         abs(credit),
		}
		if v, ok := statement.ParseAmount(row[4]); ok {
			t.BalanceAfter = &v
		}
		classify(&t)
		s.Transactions = append(s.Transactions, t)
	}

	recoverTruncated(s)
	return s, nil
}

// recoverTruncated names the truncated purchase rows from the sweep that
// accompanies them. The sweep keeps the full merchant name and states the
// purchase amount, so match on that amount within a day either side.
func recoverTruncated(s *statement.Statement) {
	sweeps := map[string]string{}
	for _, t := range s.Transactions {
		if t.Kind != statement.RoundupSweep || t.MerchantRaw == "" {
			continue
		}
		amount, ok := statedAmount(t.DescriptionRaw)
		if !ok {
			continue
		}
		key := t.PostedDate + "|" + strconv.FormatInt(amount, 10)
		if _, seen := sweeps[key]; !seen {
			sweeps[key] = t.MerchantRaw
		}
	}
	for i := range s.Transactions {
		t := &s.Transactions[i]
		if t.MerchantRaw != "" || !truncated.MatchString(t.DescriptionRaw) {
			continue
		}
		day, err := time.Parse("2006-01-02", t.PostedDate)
		if err != nil {
			continue
		}
		for _, offset := range []int{0, -1, 1} {
			key := day.AddDate(0, 0, offset).Format("2006-01-02") + "|" + strconv.FormatInt(t.Debit, 10)
			if merchant, ok := sweeps[key]; ok {
				t.MerchantRaw = merchant
				break
			}
		}
	}
}

func abs(v int64) int64 {
	if v < 0 {
		return -v
	}
	return v
}
