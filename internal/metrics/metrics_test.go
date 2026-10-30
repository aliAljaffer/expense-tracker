package metrics

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/prometheus/client_golang/prometheus/testutil"

	"github.com/aliAljaffer/grooszy/internal/ledger"
)

type fakeSource struct {
	m   ledger.Metrics
	err error
}

func (f fakeSource) Metrics(context.Context) (ledger.Metrics, error) {
	return f.m, f.err
}

func TestBusinessMetrics(t *testing.T) {
	m := New(fakeSource{m: ledger.Metrics{
		Transactions:             120,
		TransactionsCurrentMonth: 7,
		SpendingSARMonth:         1234.5,
		UncategorisedSARMonth:    100,
		Imports:                  3,
		LastImportUnix:           1700000000,
	}})

	for name, want := range map[string]float64{
		"grooszy_transactions":                             120,
		"grooszy_transactions_current_month":               7,
		"grooszy_spending_sar_current_month":               1234.5,
		"grooszy_uncategorised_spending_sar_current_month": 100,
		"grooszy_imports":                                  3,
		"grooszy_last_import_timestamp_seconds":            1700000000,
		"grooszy_business_metrics_up":                      1,
	} {
		if got, want := gatherValue(t, m, name), want; got != want {
			t.Errorf("%s = %v, want %v", name, got, want)
		}
	}
}

func TestBusinessMetricsFailureIsExposed(t *testing.T) {
	m := New(fakeSource{err: context.DeadlineExceeded})
	if got := gatherValue(t, m, "grooszy_business_metrics_up"); got != 0 {
		t.Fatalf("grooszy_business_metrics_up = %v, want 0", got)
	}
}

func gatherValue(t *testing.T, m *Metrics, name string) float64 {
	t.Helper()
	families, err := m.registry.Gather()
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range families {
		if f.GetName() != name {
			continue
		}
		return f.GetMetric()[0].GetGauge().GetValue()
	}
	t.Fatalf("metric %s not found", name)
	return 0
}

func TestHTTPMiddlewareUsesRoutePattern(t *testing.T) {
	m := New(fakeSource{})
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/transactions/{id}", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})

	m.Middleware(mux).ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, "/api/transactions/42", nil))

	if got := testutil.ToFloat64(m.requests.WithLabelValues(http.MethodGet, "GET /api/transactions/{id}", "418")); got != 1 {
		t.Fatalf("request counter = %v, want 1", got)
	}
}
