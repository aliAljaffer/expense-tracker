// Package alrajhi parses an Al Rajhi "Account Statement" PDF export.
//
// The bank is identified from the IBAN, never from names in the body: an
// inward transfer quotes the sending bank's BIC, so an Al Rajhi statement can
// mention Alinma many times.
package alrajhi

import (
	"regexp"
	"strconv"
	"strings"

	"github.com/aliAljaffer/grooszy/parsers/statement"
)

// Version changes whenever parsed output changes. Imports store it.
const Version = "1"

// kindOf maps the transaction type printed above each row. A type missing from
// this table stays unknown and keeps its amounts, so the statement still
// balances.
var kindOf = map[string]statement.Kind{
	"POS purchase Apple pay (Domestic)":         statement.CardPurchase,
	"POS purchase Atheer (Domestic)":            statement.CardPurchase,
	"POS purchase Apple pay (International)":    statement.IntlPurchase,
	"Online purchase Apple pay (Domestic)":      statement.OnlinePurchase,
	"Online purchase Apple pay (International)": statement.IntlPurchase,
	"Internal Transfer":                         statement.InternalTransfer,
	"Inward IPS Credit Transfer":                statement.ExternalTransferIn,
	"Outward IPS Credit Transfer":               statement.ExternalTransferOut,
	"Outward IPS Credit Transaction Charges":    statement.Fee,
	"Kiosk - ATM Card Renewal Fees":             statement.Fee,
	"Dynamic Currencies Debit Card Markup":      statement.Fee,
	"Message to beneficiary":                    statement.Fee,
	"Debit - Credit Cards Transactions":         statement.CardPayment,
	"Sadad Payments":                            statement.BillPayment,
	"Credit Salary":                             statement.Salary,
	"ATM Deposit":                               statement.CashDeposit,
	"ATM Withdrawal":                            statement.CashWithdrawal,
	"Cash Withdrawal":                           statement.CashWithdrawal,
	"Visa Payment":                              statement.Refund,
}

var (
	amountsRE = regexp.MustCompile(`([\d,]+\.\d{2}) SAR\s+([\d,]+\.\d{2}) SAR\s+(-?[\d,]+\.\d{2}) SAR\s*$`)
	dateRE    = regexp.MustCompile(`^\s*(\d{4}/\d{2}/\d{2})\s`)

	customerRE         = regexp.MustCompile(`Customer Name\s+(.+?)\s{2,}`)
	accountRE          = regexp.MustCompile(`Account Number\s+(\d+)`)
	ibanRE             = regexp.MustCompile(`IBAN Number\s+(SA\d+)`)
	openingRE          = regexp.MustCompile(`Opening Balance\s+([\d,]+\.\d{2}) SAR`)
	closingRE          = regexp.MustCompile(`Closing Balance\s+([\d,]+\.\d{2}) SAR`)
	depositsRE         = regexp.MustCompile(`Number Of Deposits\s+(\d+)`)
	withdrawalsRE      = regexp.MustCompile(`Number Of Withdrawals\s+(\d+)`)
	totalDepositsRE    = regexp.MustCompile(`Total Deposits\s+([\d,]+\.\d{2}) SAR`)
	totalWithdrawalsRE = regexp.MustCompile(`Total Withdrawals\s+([\d,]+\.\d{2}) SAR`)
	periodRE           = regexp.MustCompile(`(\d{4}/\d{2}/\d{2})\s+(?:-\s+)?(\d{4}/\d{2}/\d{2})`)

	sadadRE    = regexp.MustCompile(`W#(\d+)-\d+\s*-(\d+)`)
	cardRE     = regexp.MustCompile(`(?:ending -|\*{6})\s*(\d{4})`)
	transferRE = regexp.MustCompile(`\d+/([^/]+?)(?:\s+[\d,]+\.\d{2} SAR|$)`)

	notesPrefix = regexp.MustCompile(`^.*?Notes:`)
	timePrefix  = regexp.MustCompile(`^Time:\d{2}:\d{2}:\d{2},\s*`)
	terminalRef = regexp.MustCompile(`^\(\d+-\d+\)\s*`)
	onlineFrom  = regexp.MustCompile(`^Online Purchase from `)
	cityTail    = regexp.MustCompile(`,\s*[A-Z][A-Za-z ]*,\s*SA\b`)
	amountTail  = regexp.MustCompile(`\s+[\d,]+\.\d{2} SAR`)
)

// Parse reads an Al Rajhi PDF export. It does not decide whether the statement
// is trustworthy; call Reconcile on the result and refuse when it fails.
func Parse(data []byte) (*statement.Statement, error) {
	lines, err := extractLines(data)
	if err != nil {
		return nil, err
	}
	return parseLines(lines), nil
}

func parseLines(lines []string) *statement.Statement {
	s := &statement.Statement{
		Parser:        "alrajhi",
		ParserVersion: Version,
		Currency:      "SAR",
	}
	parseHeader(lines, s)

	seen := map[string]bool{}
	for i, line := range lines {
		m := amountsRE.FindStringSubmatch(line)
		if m == nil {
			continue
		}
		debit, okDebit := statement.ParseAmount(m[1])
		credit, okCredit := statement.ParseAmount(m[2])
		balance, okBalance := statement.ParseAmount(m[3])
		if !okDebit || !okCredit || !okBalance {
			continue
		}

		// The amount triple can sit on the date line or several lines below
		// it, so anchor on the amounts and walk backwards.
		date, dateIdx := "", -1
		for j := i; j >= 0 && j > i-9; j-- {
			if dm := dateRE.FindStringSubmatch(lines[j]); dm != nil {
				date, dateIdx = dm[1], j
				break
			}
		}
		if date == "" {
			continue
		}

		kind := statement.Unknown
		for j := dateIdx; j >= 0 && j > dateIdx-5; j-- {
			// Do not walk past the previous row's date: an unknown title would
			// otherwise inherit the transaction type above it.
			if j != dateIdx && dateRE.MatchString(lines[j]) {
				break
			}
			if k, ok := kindOf[strings.TrimSpace(lines[j])]; ok {
				kind = k
				break
			}
		}

		// The merchant often continues on the line after the amounts.
		tail := ""
		if i+1 < len(lines) {
			end := i + 3
			if end > len(lines) {
				end = len(lines)
			}
			var parts []string
			for _, l := range lines[i+1 : end] {
				trimmed := strings.TrimSpace(l)
				_, isType := kindOf[trimmed]
				if trimmed == "" || isType || strings.Contains(trimmed, "SAR") || dateRE.MatchString(l) ||
					strings.HasPrefix(trimmed, "Notes") || strings.Trim(trimmed, "0123456789") == "" {
					break
				}
				parts = append(parts, trimmed)
			}
			tail = strings.Join(parts, " ")
		}
		body := amountsRE.ReplaceAllString(lines[dateIdx], "")
		desc := strings.Join(strings.Fields(body+" "+tail), " ")

		key := date + "|" + m[1] + "|" + m[2] + "|" + m[3]
		if seen[key] {
			continue
		}
		seen[key] = true

		t := statement.Transaction{
			Kind:           statement.Unknown,
			PostedDate:     strings.ReplaceAll(date, "/", "-"),
			DescriptionRaw: desc,
			Debit:          debit,
			Credit:         credit,
			BalanceAfter:   &balance,
		}
		classify(&t, kind)
		s.Transactions = append(s.Transactions, t)
	}
	return s
}

func parseHeader(lines []string, s *statement.Statement) {
	if len(lines) > 80 {
		lines = lines[:80]
	}
	text := strings.Join(lines, "\n")

	grab := func(re *regexp.Regexp) string {
		if m := re.FindStringSubmatch(text); m != nil {
			return m[1]
		}
		return ""
	}
	amount := func(re *regexp.Regexp) *int64 {
		v, ok := statement.ParseAmount(grab(re))
		if !ok {
			return nil
		}
		return &v
	}
	count := func(re *regexp.Regexp) *int {
		v, err := strconv.Atoi(grab(re))
		if err != nil {
			return nil
		}
		return &v
	}

	s.CustomerName = grab(customerRE)
	s.AccountNumber = grab(accountRE)
	s.IBAN = grab(ibanRE)
	s.Bank = statement.BankFromIBAN(s.IBAN)
	s.OpeningBalance = amount(openingRE)
	s.ClosingBalance = amount(closingRE)
	s.StatedCreditCount = count(depositsRE)
	s.StatedDebitCount = count(withdrawalsRE)
	s.StatedCreditTotal = amount(totalDepositsRE)
	s.StatedDebitTotal = amount(totalWithdrawalsRE)
	if m := periodRE.FindStringSubmatch(text); m != nil {
		s.PeriodStart, s.PeriodEnd = m[1], m[2]
	}
}

func classify(t *statement.Transaction, kind statement.Kind) {
	t.Kind = kind
	switch kind {
	case statement.BillPayment:
		if m := sadadRE.FindStringSubmatch(t.DescriptionRaw); m != nil {
			t.BillerCode, t.BillerAccount = m[1], m[2]
		}
	case statement.CardPayment:
		if m := cardRE.FindStringSubmatch(t.DescriptionRaw); m != nil {
			t.CardLast4 = m[1]
		}
	case statement.CardPurchase, statement.OnlinePurchase, statement.IntlPurchase:
		t.MerchantRaw = merchant(t.DescriptionRaw)
	case statement.ExternalTransferOut, statement.ExternalTransferIn:
		body := notesPrefix.ReplaceAllString(t.DescriptionRaw, "")
		if m := transferRE.FindStringSubmatch(body); m != nil {
			t.MerchantRaw = strings.TrimSpace(m[1])
		}
	}
}

// merchant strips the routing data around the name: the terminal reference
// pair, the time, and the trailing city and amount.
func merchant(desc string) string {
	n := notesPrefix.ReplaceAllString(desc, "")
	n = timePrefix.ReplaceAllString(n, "")
	n = terminalRef.ReplaceAllString(n, "")
	n = onlineFrom.ReplaceAllString(n, "")
	if loc := cityTail.FindStringIndex(n); loc != nil {
		n = n[:loc[0]]
	}
	if loc := amountTail.FindStringIndex(n); loc != nil {
		n = n[:loc[0]]
	}
	return strings.Trim(strings.Join(strings.Fields(n), " "), " ,")
}
