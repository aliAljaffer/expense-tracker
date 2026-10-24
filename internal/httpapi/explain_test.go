package httpapi

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/aliAljaffer/expense-tracker/internal/auth"
	"github.com/aliAljaffer/expense-tracker/internal/explain"
)

func fakeProvider(t *testing.T, respond func(http.ResponseWriter)) (*httptest.Server, *atomic.Int32) {
	t.Helper()
	var calls atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		respond(w)
	}))
	t.Cleanup(srv.Close)
	return srv, &calls
}

func openAIProse(w http.ResponseWriter) {
	io.WriteString(w, `{"choices":[{"message":{"role":"assistant","content":"Spending looks steady."}}]}`)
}

func testExplainer(t *testing.T, provider, baseURL string) *explain.Explainer {
	t.Helper()
	return explain.New(explain.Config{
		Provider: provider,
		BaseURL:  baseURL,
		Model:    "test-model",
		APIKey:   "test-key",
		Enabled:  true,
	})
}

func explainServer(t *testing.T, ex *explain.Explainer) http.Handler {
	t.Helper()
	return New(nil, stubAuth{id: auth.Identity{Subject: "owner"}}, 1<<20, ex,
		slog.New(slog.NewTextHandler(io.Discard, nil)))
}

func validExplainBody() string {
	return `{"kind":"fees","account_kind":"current","period":{"start":"2026-03-01","end":"2026-03-31"},"aggregates":{"total_debit":2575,"transaction_count":12}}`
}

func TestExplainStatusWithoutExplainer(t *testing.T) {
	h := newTestServer(stubAuth{id: auth.Identity{Subject: "owner"}})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/explainers/status", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["enabled"] != false {
		t.Fatalf("body = %v", body)
	}
}

func TestExplainStatusHidesKeyAndBaseURL(t *testing.T) {
	srv, _ := fakeProvider(t, openAIProse)
	h := explainServer(t, testExplainer(t, "openai", srv.URL))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/explainers/status", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	raw := rec.Body.String()
	if strings.Contains(raw, "test-key") || strings.Contains(raw, srv.URL) {
		t.Fatalf("status leaked a secret: %s", raw)
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["enabled"] != true || body["provider"] != "openai" || body["model"] != "test-model" {
		t.Fatalf("body = %v", body)
	}
}

func TestExplainConflictWhenDisabled(t *testing.T) {
	for name, ex := range map[string]*explain.Explainer{
		"nil":       nil,
		"no config": explain.New(explain.Config{}),
	} {
		t.Run(name, func(t *testing.T) {
			h := explainServer(t, ex)
			rec := httptest.NewRecorder()
			req := httptest.NewRequest("POST", "/api/explanations", strings.NewReader(validExplainBody()))
			h.ServeHTTP(rec, req)
			if rec.Code != http.StatusConflict {
				t.Fatalf("status = %d, want 409", rec.Code)
			}
		})
	}
}

func TestExplainRejectsDisallowedField(t *testing.T) {
	srv, calls := fakeProvider(t, openAIProse)
	h := explainServer(t, testExplainer(t, "openai", srv.URL))

	rec := httptest.NewRecorder()
	body := `{"kind":"fees","description":"synthetic merchant","period":{"start":"2026-03-01","end":"2026-03-31"}}`
	h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/explanations", strings.NewReader(body)))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "description") {
		t.Fatalf("error does not name the field: %s", rec.Body.String())
	}
	if calls.Load() != 0 {
		t.Fatal("provider was called for a rejected body")
	}
}

func TestExplainRejectsOversizedBody(t *testing.T) {
	srv, _ := fakeProvider(t, openAIProse)
	h := explainServer(t, testExplainer(t, "openai", srv.URL))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/explanations",
		strings.NewReader(strings.Repeat("a", 65*1024))))
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413", rec.Code)
	}
}

func TestExplainGatewayWhenProviderFails(t *testing.T) {
	srv, _ := fakeProvider(t, func(w http.ResponseWriter) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	h := explainServer(t, testExplainer(t, "openai", srv.URL))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/explanations", strings.NewReader(validExplainBody())))
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502", rec.Code)
	}
}

func TestExplainReturnsTextAndTouchesNoStore(t *testing.T) {
	srv, calls := fakeProvider(t, openAIProse)
	h := explainServer(t, testExplainer(t, "openai", srv.URL))

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/explanations", strings.NewReader(validExplainBody())))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body.String())
	}
	if calls.Load() != 1 {
		t.Fatalf("provider calls = %d", calls.Load())
	}
	var body map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body) != 3 || body["text"] != "Spending looks steady." || body["model"] != "test-model" || body["provider"] != "openai" {
		t.Fatalf("body = %v", body)
	}
}
