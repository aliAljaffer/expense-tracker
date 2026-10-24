package httpapi

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aliAljaffer/expense-tracker/internal/auth"
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
