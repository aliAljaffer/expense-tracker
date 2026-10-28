package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aliAljaffer/grooszy/internal/auth"
)

func TestCardCoverageRequiresAuth(t *testing.T) {
	h := newTestServer(stubAuth{err: auth.ErrUnauthenticated})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/suggestions/card-coverage", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestCardCoverageWithoutStoreReturn503(t *testing.T) {
	h := newTestServer(stubAuth{id: auth.Identity{Subject: "owner"}})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/suggestions/card-coverage", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
}

func TestRecurringRequiresAuth(t *testing.T) {
	h := newTestServer(stubAuth{err: auth.ErrUnauthenticated})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/suggestions/recurring", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestRecurringWithoutStoreReturn503(t *testing.T) {
	h := newTestServer(stubAuth{id: auth.Identity{Subject: "owner"}})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/suggestions/recurring", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
}

func TestBNPLRequiresAuth(t *testing.T) {
	h := newTestServer(stubAuth{err: auth.ErrUnauthenticated})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/suggestions/bnpl", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestBNPLWithoutStoreReturn503(t *testing.T) {
	h := newTestServer(stubAuth{id: auth.Identity{Subject: "owner"}})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/suggestions/bnpl", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
}

func TestSuggestionsAreAddedToProtectedRoutes(t *testing.T) {
	h := newTestServer(stubAuth{id: auth.Identity{Subject: "owner"}})
	for _, path := range []string{
		"/api/suggestions/card-coverage",
		"/api/suggestions/recurring",
		"/api/suggestions/bnpl",
		"/api/suggestions/salary-trend",
		"/api/suggestions/transfer-matches",
	} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
		if rec.Code == http.StatusNotFound {
			t.Fatalf("%s not found", path)
		}
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("%s status = %d, expected 503 (no store)", path, rec.Code)
		}
	}
}

func TestSalaryTrendRequiresAuth(t *testing.T) {
	h := newTestServer(stubAuth{err: auth.ErrUnauthenticated})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/suggestions/salary-trend", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}

func TestSalaryTrendWithoutStoreReturn503(t *testing.T) {
	h := newTestServer(stubAuth{id: auth.Identity{Subject: "owner"}})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/suggestions/salary-trend", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
}

func TestTransferMatchesWithoutStoreReturn503(t *testing.T) {
	h := newTestServer(stubAuth{id: auth.Identity{Subject: "owner"}})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/suggestions/transfer-matches", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", rec.Code)
	}
}

func TestSuggestionDecisionRejectsUnknownKind(t *testing.T) {
	h := newTestServer(stubAuth{id: auth.Identity{Subject: "owner"}})
	for _, method := range []string{"POST", "DELETE"} {
		rec := httptest.NewRecorder()
		body := strings.NewReader(`{"decision":"dismissed"}`)
		h.ServeHTTP(rec, httptest.NewRequest(method, "/api/suggestions/shared-expense/decision", body))
		if rec.Code != http.StatusUnprocessableEntity {
			t.Fatalf("%s unknown kind status = %d, want 422", method, rec.Code)
		}
	}
}

func TestSuggestionDecisionRejectsUnknownDecision(t *testing.T) {
	h := newTestServer(stubAuth{id: auth.Identity{Subject: "owner"}})
	for _, body := range []string{`{"decision":"ignored"}`, `{}`, `not json`} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/suggestions/recurring/decision",
			strings.NewReader(body)))
		if rec.Code != http.StatusUnprocessableEntity {
			t.Fatalf("body %q status = %d, want 422", body, rec.Code)
		}
	}
}

func TestSuggestionDecisionWithoutStoreReturn503(t *testing.T) {
	h := newTestServer(stubAuth{id: auth.Identity{Subject: "owner"}})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/suggestions/recurring/decision",
		strings.NewReader(`{"decision":"dismissed"}`)))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("POST status = %d, want 503", rec.Code)
	}
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("DELETE", "/api/suggestions/recurring/decision", nil))
	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("DELETE status = %d, want 503", rec.Code)
	}
}

func TestSuggestionDecisionRequiresAuth(t *testing.T) {
	h := newTestServer(stubAuth{err: auth.ErrUnauthenticated})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/suggestions/recurring/decision",
		strings.NewReader(`{"decision":"dismissed"}`)))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}
