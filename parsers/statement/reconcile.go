package statement

import "strconv"

// Reconcile checks the parse against the six header figures and the balance
// walk. Callers must refuse an import when OK is false.
func (s *Statement) Reconcile() Reconciliation {
	r := Reconciliation{}
	for _, t := range s.Transactions {
		if t.Debit > 0 {
			r.DebitTotal += t.Debit
			r.DebitCount++
		}
		if t.Credit > 0 {
			r.CreditTotal += t.Credit
			r.CreditCount++
		}
	}

	check := func(name string, ok bool, parsed, stated string) {
		status := Fail
		if ok {
			status = Pass
		}
		r.Checks = append(r.Checks, Check{Name: name, Status: status, Parsed: parsed, Stated: stated})
	}
	skip := func(name string) {
		r.Checks = append(r.Checks, Check{Name: name, Status: Skip})
	}

	if s.StatedDebitTotal != nil {
		want := abs(*s.StatedDebitTotal)
		check("debit_total", r.DebitTotal == want, FormatAmount(r.DebitTotal), FormatAmount(want))
	} else {
		skip("debit_total")
	}
	if s.StatedCreditTotal != nil {
		want := abs(*s.StatedCreditTotal)
		check("credit_total", r.CreditTotal == want, FormatAmount(r.CreditTotal), FormatAmount(want))
	} else {
		skip("credit_total")
	}
	if s.StatedDebitCount != nil {
		check("debit_count", r.DebitCount == *s.StatedDebitCount,
			strconv.Itoa(r.DebitCount), strconv.Itoa(*s.StatedDebitCount))
	} else {
		skip("debit_count")
	}
	if s.StatedCreditCount != nil {
		check("credit_count", r.CreditCount == *s.StatedCreditCount,
			strconv.Itoa(r.CreditCount), strconv.Itoa(*s.StatedCreditCount))
	} else {
		skip("credit_count")
	}
	if s.OpeningBalance != nil && s.ClosingBalance != nil {
		implied := *s.OpeningBalance + r.CreditTotal - r.DebitTotal
		check("balance_walk", implied == *s.ClosingBalance,
			FormatAmount(implied), FormatAmount(*s.ClosingBalance))
	} else {
		skip("balance_walk")
	}

	r.OK = true
	for _, c := range r.Checks {
		if c.Status == Fail {
			r.OK = false
		}
	}
	return r
}

func abs(v int64) int64 {
	if v < 0 {
		return -v
	}
	return v
}
