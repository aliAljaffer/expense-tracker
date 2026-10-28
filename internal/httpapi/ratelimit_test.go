package httpapi

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/aliAljaffer/grooszy/internal/auth"
)

func TestLimiterRefillsAfterWindow(t *testing.T) {
	clock := time.Date(2026, 10, 28, 12, 0, 0, 0, time.UTC)
	l := newLimiter(2, time.Minute)
	l.now = func() time.Time { return clock }

	if !l.allow("owner") || !l.allow("owner") {
		t.Fatal("first two calls should pass")
	}
	if l.allow("owner") {
		t.Fatal("third call inside the window should be refused")
	}
	if !l.allow("other") {
		t.Fatal("a different key should have its own budget")
	}
	clock = clock.Add(time.Minute)
	if !l.allow("owner") {
		t.Fatal("a new window should allow again")
	}
}

func TestProviderRoutesAreLimited(t *testing.T) {
	h := newTestServer(stubAuth{id: auth.Identity{Subject: "owner"}})
	body := []byte(`{}`)
	for i := 0; i < providerCallsPerMinute; i++ {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/explanations", bytes.NewReader(body)))
		if rec.Code == http.StatusTooManyRequests {
			t.Fatalf("call %d limited too early", i+1)
		}
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/explanations", bytes.NewReader(body)))
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429", rec.Code)
	}
	if rec.Header().Get("Retry-After") == "" {
		t.Fatal("429 should carry Retry-After")
	}
}
