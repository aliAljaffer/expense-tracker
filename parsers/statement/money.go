package statement

import (
	"strconv"
	"strings"
)

// ParseAmount converts a statement amount ("1,234.56", "-12.00") to halalas.
// A value with more than two decimal places is rejected, not rounded: a parse
// that silently changes an amount cannot reconcile.
func ParseAmount(s string) (int64, bool) {
	s = strings.TrimSpace(strings.ReplaceAll(s, ",", ""))
	if s == "" {
		return 0, false
	}
	neg := strings.HasPrefix(s, "-")
	if neg || strings.HasPrefix(s, "+") {
		s = s[1:]
	}
	whole, frac, _ := strings.Cut(s, ".")
	if len(frac) > 2 || (whole == "" && frac == "") {
		return 0, false
	}
	for _, c := range whole + frac {
		if c < '0' || c > '9' {
			return 0, false
		}
	}
	for len(frac) < 2 {
		frac += "0"
	}
	v, err := strconv.ParseInt(whole+frac, 10, 64)
	if err != nil {
		return 0, false
	}
	if neg {
		return -v, true
	}
	return v, true
}

// FormatAmount renders halalas as a plain decimal amount, for reports.
func FormatAmount(v int64) string {
	sign := ""
	if v < 0 {
		sign, v = "-", -v
	}
	cents := strconv.FormatInt(v%100, 10)
	if len(cents) == 1 {
		cents = "0" + cents
	}
	return sign + strconv.FormatInt(v/100, 10) + "." + cents
}
