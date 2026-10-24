package explain

import (
	"net/http"
	"strings"
	"testing"
)

func TestParseRequestAcceptsAllowlistedBody(t *testing.T) {
	body := `{
		"kind": "duplicate",
		"account_kind": "credit_card",
		"period": {"start": "2026-03-01", "end": "2026-03-31"},
		"aggregates": {"total_debit": 62400, "transaction_count": 12, "median_debit": 2575}
	}`
	req, err := ParseRequest([]byte(body))
	if err != nil {
		t.Fatal(err)
	}
	if req.Kind != "duplicate" || req.AccountKind != "credit_card" {
		t.Fatalf("req = %+v", req)
	}
	if req.Aggregates.TotalDebit != 62400 || req.Aggregates.TransactionCount != 12 {
		t.Fatalf("aggregates = %+v", req.Aggregates)
	}
}

func TestParseRequestNamesFirstDisallowedField(t *testing.T) {
	cases := []struct {
		name string
		body string
		want string
	}{
		{"top level", `{"kind":"fees","description":"synthetic merchant"}`, "description"},
		{"aggregate", `{"kind":"fees","aggregates":{"merchant":"synthetic"}}`, "aggregates.merchant"},
		{"period", `{"kind":"fees","period":{"start":"2026-03-01","end":"2026-03-31","zone":"UTC"}}`, "period.zone"},
		{"raw description nested", `{"kind":"fees","aggregates":{"description":"synthetic"}}`, "aggregates.description"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := ParseRequest([]byte(tc.body))
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("err = %v, want field %q", err, tc.want)
			}
		})
	}
}

func TestParseRequestRejectsUnsupportedKind(t *testing.T) {
	body := `{"kind":"poem","period":{"start":"2026-03-01","end":"2026-03-31"}}`
	_, err := ParseRequest([]byte(body))
	if err == nil || !strings.Contains(err.Error(), "unsupported kind") {
		t.Fatalf("err = %v", err)
	}
}

func TestParseRequestRejectsNonIntegerAggregate(t *testing.T) {
	body := `{"kind":"fees","period":{"start":"2026-03-01","end":"2026-03-31"},"aggregates":{"total_debit":25.75}}`
	_, err := ParseRequest([]byte(body))
	if err == nil || !strings.Contains(err.Error(), "aggregates.total_debit") {
		t.Fatalf("err = %v", err)
	}
}

func TestParseRequestRejectsBadDate(t *testing.T) {
	body := `{"kind":"fees","period":{"start":"March","end":"2026-03-31"}}`
	_, err := ParseRequest([]byte(body))
	if err == nil || !strings.Contains(err.Error(), "period.start") {
		t.Fatalf("err = %v", err)
	}
}

func TestParseRequestRejectsNonObject(t *testing.T) {
	for _, body := range []string{`[]`, `"text"`, `{} {}`} {
		if _, err := ParseRequest([]byte(body)); err == nil {
			t.Fatalf("body %s was accepted", body)
		}
	}
}

func TestExplainSendsOnlyAllowlistedFields(t *testing.T) {
	srv, got := captureServer(t, func(w http.ResponseWriter) {
		w.Write([]byte(`{"choices":[{"message":{"content":"ok"}}]}`))
	})
	e := New(Config{Provider: ProviderOpenAI, BaseURL: srv.URL, Model: "m", APIKey: "k", Enabled: true})
	req, err := ParseRequest([]byte(`{
		"kind":"anomaly",
		"period":{"start":"2026-03-01","end":"2026-03-31"},
		"aggregates":{"total_debit":2575}
	}`))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := e.Explain(t.Context(), req); err != nil {
		t.Fatal(err)
	}
	sent, _ := got.get()
	user := sent["messages"].([]any)[1].(map[string]any)["content"].(string)
	for _, forbidden := range []string{"description", "merchant", "iban", "account_number", "card"} {
		if strings.Contains(strings.ToLower(user), forbidden) {
			t.Fatalf("prompt carries %q: %s", forbidden, user)
		}
	}
}
