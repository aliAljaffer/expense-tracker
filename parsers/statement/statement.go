// Package statement holds the normalized record both bank parsers produce.
//
// Every SAR amount is an integer count of halalas. Statements are money, so
// floating point is never used for parsing, reconciliation, or storage.
package statement

// Kind is the normalized transaction type. It is the vocabulary stored in the
// database and used to decide whether a row counts as spending.
type Kind string

const (
	CardPurchase        Kind = "card_purchase"
	OnlinePurchase      Kind = "online_purchase"
	IntlPurchase        Kind = "intl_purchase"
	Refund              Kind = "refund"
	RoundupSweep        Kind = "roundup_sweep"
	InternalTransfer    Kind = "internal_transfer"
	ExternalTransferIn  Kind = "external_transfer_in"
	ExternalTransferOut Kind = "external_transfer_out"
	Salary              Kind = "salary"
	CashDeposit         Kind = "cash_deposit"
	CashWithdrawal      Kind = "cash_withdrawal"
	BillPayment         Kind = "bill_payment"
	CardPayment         Kind = "card_payment"
	Fee                 Kind = "fee"
	Unknown             Kind = "unknown"
)

// CountsAsSpending is false for transfers, sweeps, card payments, refunds, and
// deposits, so totals built from it do not inflate real spending.
func (k Kind) CountsAsSpending() bool {
	switch k {
	case CardPurchase, OnlinePurchase, IntlPurchase, BillPayment, CashWithdrawal, Fee:
		return true
	}
	return false
}

// Transaction is one statement row. Amounts are halalas; a nil pointer means
// the statement did not state that value.
type Transaction struct {
	PostedDate     string `json:"posted_date"`
	ValueDate      string `json:"value_date,omitempty"`
	DescriptionRaw string `json:"description_raw"`
	Debit          int64  `json:"debit"`
	Credit         int64  `json:"credit"`
	BalanceAfter   *int64 `json:"balance_after,omitempty"`
	Kind           Kind   `json:"kind"`
	MerchantRaw    string `json:"merchant_raw,omitempty"`
	FxCurrency     string `json:"fx_currency,omitempty"`
	FxAmount       *int64 `json:"fx_amount,omitempty"`
	FxRate         string `json:"fx_rate,omitempty"`
	FxFee          *int64 `json:"fx_fee,omitempty"`
	BillerCode     string `json:"biller_code,omitempty"`
	BillerAccount  string `json:"biller_account,omitempty"`
	CardLast4      string `json:"card_last4,omitempty"`
}

// Statement is one parsed export, header figures included so the parse can be
// checked against the bank's own totals before any row is stored.
type Statement struct {
	Parser        string `json:"parser"`
	ParserVersion string `json:"parser_version"`
	Bank          string `json:"bank,omitempty"`
	AccountNumber string `json:"account_number,omitempty"`
	IBAN          string `json:"iban,omitempty"`
	CustomerName  string `json:"customer_name,omitempty"`
	Currency      string `json:"currency"`
	PeriodStart   string `json:"period_start,omitempty"`
	PeriodEnd     string `json:"period_end,omitempty"`

	OpeningBalance    *int64 `json:"opening_balance,omitempty"`
	ClosingBalance    *int64 `json:"closing_balance,omitempty"`
	StatedDebitTotal  *int64 `json:"stated_debit_total,omitempty"`
	StatedCreditTotal *int64 `json:"stated_credit_total,omitempty"`
	StatedDebitCount  *int   `json:"stated_debit_count,omitempty"`
	StatedCreditCount *int   `json:"stated_credit_count,omitempty"`

	Transactions []Transaction `json:"transactions"`
}

// CheckStatus is the outcome of one reconciliation figure.
type CheckStatus string

const (
	Pass CheckStatus = "pass"
	Fail CheckStatus = "fail"
	Skip CheckStatus = "skip"
)

// Check is one header figure compared against the parse.
type Check struct {
	Name   string      `json:"name"`
	Status CheckStatus `json:"status"`
	Parsed string      `json:"parsed,omitempty"`
	Stated string      `json:"stated,omitempty"`
}

// Reconciliation compares the parse against the six header figures and the
// balance walk. OK is false when any check fails. An import must be refused
// when OK is false: a short parse is otherwise silent.
type Reconciliation struct {
	OK          bool    `json:"ok"`
	Checks      []Check `json:"checks"`
	DebitTotal  int64   `json:"parsed_debit_total"`
	CreditTotal int64   `json:"parsed_credit_total"`
	DebitCount  int     `json:"parsed_debit_count"`
	CreditCount int     `json:"parsed_credit_count"`
}
