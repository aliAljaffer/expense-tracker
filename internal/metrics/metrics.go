// Package metrics exposes Prometheus metrics for the grooszy API: HTTP request
// metrics for every route, plus business gauges read from Postgres on scrape.
package metrics

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/aliAljaffer/grooszy/internal/ledger"
)

// Source is the slice of the ledger store the business gauges need.
type Source interface {
	Metrics(ctx context.Context) (ledger.Metrics, error)
}

type Metrics struct {
	registry *prometheus.Registry
	requests *prometheus.CounterVec
	duration *prometheus.HistogramVec
	inFlight prometheus.Gauge
}

func New(src Source) *Metrics {
	registry := prometheus.NewRegistry()
	m := &Metrics{
		registry: registry,
		requests: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "grooszy_http_requests_total",
			Help: "HTTP requests handled, by method, route pattern and status code.",
		}, []string{"method", "route", "status"}),
		duration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name:    "grooszy_http_request_duration_seconds",
			Help:    "HTTP request latency, by method and route pattern.",
			Buckets: prometheus.DefBuckets,
		}, []string{"method", "route"}),
		inFlight: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "grooszy_http_requests_in_flight",
			Help: "HTTP requests currently being served.",
		}),
	}
	registry.MustRegister(
		collectors.NewGoCollector(),
		collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}),
		collectors.NewBuildInfoCollector(),
		m.requests, m.duration, m.inFlight,
		newBusiness(src),
	)
	return m
}

func (m *Metrics) Handler() http.Handler {
	return promhttp.HandlerFor(m.registry, promhttp.HandlerOpts{})
}

// Middleware records every request. r.Pattern is the ServeMux pattern
// ("GET /api/transactions/{id}"), which keeps label cardinality bounded.
func (m *Metrics) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		m.inFlight.Inc()
		defer m.inFlight.Dec()

		start := time.Now()
		sw := &statusWriter{ResponseWriter: w}
		next.ServeHTTP(sw, r)

		route := r.Pattern
		if route == "" {
			route = "unmatched"
		}
		status := sw.status
		if status == 0 {
			status = http.StatusOK
		}
		m.requests.WithLabelValues(r.Method, route, strconv.Itoa(status)).Inc()
		m.duration.WithLabelValues(r.Method, route).Observe(time.Since(start).Seconds())
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	if w.status == 0 {
		w.status = code
	}
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) Write(b []byte) (int, error) {
	if w.status == 0 {
		w.status = http.StatusOK
	}
	return w.ResponseWriter.Write(b)
}

type business struct {
	src           Source
	transactions  *prometheus.Desc
	monthly       *prometheus.Desc
	spending      *prometheus.Desc
	uncategorised *prometheus.Desc
	imports       *prometheus.Desc
	lastImport    *prometheus.Desc
	scrapeFailed  *prometheus.Desc
}

func newBusiness(src Source) *business {
	return &business{
		src: src,
		transactions: prometheus.NewDesc("grooszy_transactions",
			"Stored transactions, all time.", nil, nil),
		monthly: prometheus.NewDesc("grooszy_transactions_current_month",
			"Transactions posted in the current calendar month.", nil, nil),
		spending: prometheus.NewDesc("grooszy_spending_sar_current_month",
			"Spending in SAR for the current calendar month.", nil, nil),
		uncategorised: prometheus.NewDesc("grooszy_uncategorised_spending_sar_current_month",
			"Spending in SAR with no category for the current calendar month.", nil, nil),
		imports: prometheus.NewDesc("grooszy_imports",
			"Statement imports accepted.", nil, nil),
		lastImport: prometheus.NewDesc("grooszy_last_import_timestamp_seconds",
			"Unix timestamp of the most recent accepted statement import.", nil, nil),
		scrapeFailed: prometheus.NewDesc("grooszy_business_metrics_up",
			"Whether the business gauges were collected from the database on this scrape.", nil, nil),
	}
}

func (b *business) Describe(ch chan<- *prometheus.Desc) {
	ch <- b.transactions
	ch <- b.monthly
	ch <- b.spending
	ch <- b.uncategorised
	ch <- b.imports
	ch <- b.lastImport
	ch <- b.scrapeFailed
}

func (b *business) Collect(ch chan<- prometheus.Metric) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	m, err := b.src.Metrics(ctx)
	if err != nil {
		ch <- prometheus.MustNewConstMetric(b.scrapeFailed, prometheus.GaugeValue, 0)
		log.Printf("metrics: reading business gauges: %v", err)
		return
	}
	ch <- prometheus.MustNewConstMetric(b.transactions, prometheus.GaugeValue, float64(m.Transactions))
	ch <- prometheus.MustNewConstMetric(b.monthly, prometheus.GaugeValue, float64(m.TransactionsCurrentMonth))
	ch <- prometheus.MustNewConstMetric(b.spending, prometheus.GaugeValue, m.SpendingSARMonth)
	ch <- prometheus.MustNewConstMetric(b.uncategorised, prometheus.GaugeValue, m.UncategorisedSARMonth)
	ch <- prometheus.MustNewConstMetric(b.imports, prometheus.GaugeValue, float64(m.Imports))
	ch <- prometheus.MustNewConstMetric(b.lastImport, prometheus.GaugeValue, m.LastImportUnix)
	ch <- prometheus.MustNewConstMetric(b.scrapeFailed, prometheus.GaugeValue, 1)
}
