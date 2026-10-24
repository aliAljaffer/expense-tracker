package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"log/slog"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/aliAljaffer/grooszy/internal/auth"
)

type stubAuth struct {
	id  auth.Identity
	err error
}

func (s stubAuth) Authenticate(*http.Request) (auth.Identity, error) { return s.id, s.err }

func newTestServer(a Authenticator) http.Handler {
	return New(nil, nil, a, 1<<20, nil, slog.New(slog.NewTextHandler(io.Discard, nil)))
}

func TestHealthIsPublic(t *testing.T) {
	h := newTestServer(stubAuth{err: auth.ErrUnauthenticated})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/healthz", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestProtectedRoutesRejectMissingToken(t *testing.T) {
	h := newTestServer(stubAuth{err: auth.ErrUnauthenticated})
	for _, path := range []string{"/api/me", "/api/imports/1", "/api/accounts",
		"/api/overview/monthly", "/api/transactions", "/api/explainers/status"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
		if rec.Code != http.StatusUnauthorized {
			t.Fatalf("%s status = %d, want 401", path, rec.Code)
		}
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/imports", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("upload status = %d, want 401", rec.Code)
	}
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("POST", "/api/explanations", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("explanation status = %d, want 401", rec.Code)
	}
}

func TestWrongOwnerIsForbidden(t *testing.T) {
	h := newTestServer(stubAuth{err: auth.ErrForbidden})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/me", nil))
	if rec.Code != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", rec.Code)
	}
}

func TestReadRoutesWithoutStoreReturn503(t *testing.T) {
	h := newTestServer(stubAuth{id: auth.Identity{Subject: "owner"}})
	for _, path := range []string{"/api/accounts", "/api/overview/monthly", "/api/transactions",
		"/api/suggestions/card-coverage", "/api/suggestions/recurring", "/api/suggestions/bnpl"} {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest("GET", path, nil))
		if rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("%s status = %d, want 503", path, rec.Code)
		}
	}
}

func TestOwnerCanReadIdentity(t *testing.T) {
	h := newTestServer(stubAuth{id: auth.Identity{Subject: "owner", Name: "Owner"}})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest("GET", "/api/me", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["subject"] != "owner" {
		t.Fatalf("body = %v", body)
	}
}

func TestUploadRejectsOversizedFile(t *testing.T) {
	h := New(nil, nil, stubAuth{id: auth.Identity{Subject: "owner"}}, 1024, nil,
		slog.New(slog.NewTextHandler(io.Discard, nil)))
	var buf bytes.Buffer
	mw := multipart.NewWriter(&buf)
	file, err := mw.CreateFormFile("file", "statement.xlsx")
	if err != nil {
		t.Fatal(err)
	}
	file.Write(bytes.Repeat([]byte("a"), 4096))
	mw.Close()

	req := httptest.NewRequest("POST", "/api/imports", &buf)
	req.Header.Set("Content-Type", mw.FormDataContentType())
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413", rec.Code)
	}
}
