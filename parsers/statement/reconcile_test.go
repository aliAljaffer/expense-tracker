package statement

import "testing"

func ptr[T any](v T) *T { return &v }

func statuses(r Reconciliation) map[string]CheckStatus {
	m := map[string]CheckStatus{}
	for _, c := range r.Checks {
		m[c.Name] = c.Status
	}
	return m
}

func TestReconcilePasses(t *testing.T) {
	s := &Statement{
		OpeningBalance:    ptr(int64(100000)),
		ClosingBalance:    ptr(int64(118600)),
		StatedDebitTotal:  ptr(int64(62400)),
		StatedCreditTotal: ptr(int64(81000)),
		StatedDebitCount:  ptr(2),
		StatedCreditCount: ptr(1),
		Transactions: []Transaction{
			{Debit: 2575},
			{Debit: 59825},
			{Credit: 81000},
		},
	}
	r := s.Reconcile()
	if !r.OK {
		t.Fatalf("expected ok, checks: %+v", r.Checks)
	}
	if r.DebitTotal != 62400 || r.CreditTotal != 81000 || r.DebitCount != 2 || r.CreditCount != 1 {
		t.Fatalf("unexpected totals: %+v", r)
	}
	for name, status := range statuses(r) {
		if status != Pass {
			t.Errorf("%s = %s; want pass", name, status)
		}
	}
}

func TestReconcileFailsOnMissingRow(t *testing.T) {
	s := &Statement{
		OpeningBalance:    ptr(int64(100000)),
		ClosingBalance:    ptr(int64(118600)),
		StatedDebitTotal:  ptr(int64(62400)),
		StatedCreditTotal: ptr(int64(81000)),
		StatedDebitCount:  ptr(2),
		StatedCreditCount: ptr(1),
		Transactions: []Transaction{
			{Debit: 2575},
			{Credit: 81000},
		},
	}
	r := s.Reconcile()
	if r.OK {
		t.Fatal("a short parse must not reconcile")
	}
	if got := statuses(r)["debit_count"]; got != Fail {
		t.Errorf("debit_count = %s; want fail", got)
	}
	if got := statuses(r)["balance_walk"]; got != Fail {
		t.Errorf("balance_walk = %s; want fail", got)
	}
}

func TestReconcileSkipsAbsentFigures(t *testing.T) {
	s := &Statement{Transactions: []Transaction{{Debit: 100}, {Credit: 100}}}
	r := s.Reconcile()
	if !r.OK {
		t.Fatal("nothing to compare against should not fail")
	}
	for name, status := range statuses(r) {
		if status != Skip {
			t.Errorf("%s = %s; want skip", name, status)
		}
	}
}

func TestBankFromIBAN(t *testing.T) {
	cases := map[string]string{
		"SA0080000001234567890123": "Al Rajhi",
		"SA4410000001234567890123": "Saudi National Bank",
		"SA0005000001234567890123": "Alinma",
		"SA00 0500 0001 2345":      "Alinma",
		"":                         "",
		"AE070331234567890123456":  "",
	}
	for in, want := range cases {
		if got := BankFromIBAN(in); got != want {
			t.Errorf("BankFromIBAN(%q) = %q; want %q", in, got, want)
		}
	}
}
