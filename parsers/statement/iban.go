package statement

import "strings"

// Saudi IBAN bank codes. Bank names in a statement body are unreliable: an
// inward transfer quotes the sending bank's BIC, so an Al Rajhi statement can
// mention Alinma repeatedly. The two digits after the check digits decide.
var saBankCodes = map[string]string{
	"05": "Alinma",
	"10": "Saudi National Bank",
	"15": "Banque Saudi Fransi",
	"20": "Riyad Bank",
	"30": "Arab National Bank",
	"45": "Saudi Investment Bank",
	"55": "Bank Albilad",
	"60": "Bank Aljazira",
	"80": "Al Rajhi",
}

// BankFromIBAN returns the bank that owns the IBAN, or "" when the IBAN is
// absent or not Saudi.
func BankFromIBAN(iban string) string {
	clean := strings.ToUpper(strings.ReplaceAll(iban, " ", ""))
	if !strings.HasPrefix(clean, "SA") || len(clean) < 6 {
		return ""
	}
	return saBankCodes[clean[4:6]]
}
