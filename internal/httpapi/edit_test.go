package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aliAljaffer/grooszy/internal/auth"
	"github.com/aliAljaffer/grooszy/internal/ledger"
)

type categoryCall struct {
	transactionID int64
	categoryID    *int64
	apply         bool
}

type aliasCall struct {
	merchantID int64
	alias      *string
}

type fakeEdits struct {
	categories    []ledger.Category
	categoryCalls []categoryCall
	aliasCalls    []aliasCall
	categoryErr   error
	aliasErr      error
}

func (f *fakeEdits) Categories(context.Context) ([]ledger.Category, error) {
	return f.categories, nil
}

func (f *fakeEdits) SetCategory(_ context.Context, id int64, categoryID *int64, apply bool) error {
	f.categoryCalls = append(f.categoryCalls, categoryCall{id, categoryID, apply})
	return f.categoryErr
}

func (f *fakeEdits) SetMerchantAlias(_ context.Context, id int64, alias *string) error {
	f.aliasCalls = append(f.aliasCalls, aliasCall{id, alias})
	return f.aliasErr
}

func newEditServer(store editStore) http.Handler {
	s := &Server{
		auth:      stubAuth{id: auth.Identity{Subject: "owner"}},
		edits:     store,
		maxUpload: 1 << 20,
		log:       slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
	return s.routes()
}

func editCall(h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	var r io.Reader
	if body != "" {
		r = strings.NewReader(body)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(method, path, r))
	return rec
}

func TestCategoriesListsStoredRows(t *testing.T) {
	store := &fakeEdits{categories: []ledger.Category{{ID: 1, Name: "Housing"}, {ID: 3, Name: "Groceries"}}}
	rec := editCall(newEditServer(store), "GET", "/api/categories", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	var body struct {
		Categories []ledger.Category `json:"categories"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Categories) != 2 || body.Categories[0].Name != "Housing" {
		t.Fatalf("categories = %+v", body.Categories)
	}
}

func TestCategoriesWithoutStoreReturn503(t *testing.T) {
	h := newEditServer(nil)
	for _, path := range []string{"/api/categories"} {
		if rec := editCall(h, "GET", path, ""); rec.Code != http.StatusServiceUnavailable {
			t.Fatalf("%s status = %d, want 503", path, rec.Code)
		}
	}
	if rec := editCall(h, "PATCH", "/api/transactions/1", `{"category_id":1}`); rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("patch status = %d, want 503", rec.Code)
	}
	if rec := editCall(h, "PUT", "/api/merchants/1", `{"alias":"x"}`); rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("alias status = %d, want 503", rec.Code)
	}
}

func TestPatchTransactionStoresCategory(t *testing.T) {
	store := &fakeEdits{}
	rec := editCall(newEditServer(store), "PATCH", "/api/transactions/34", `{"category_id":3,"apply_to_merchant":false}`)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body)
	}
	if len(store.categoryCalls) != 1 {
		t.Fatalf("calls = %+v", store.categoryCalls)
	}
	call := store.categoryCalls[0]
	if call.transactionID != 34 || call.categoryID == nil || *call.categoryID != 3 || call.apply {
		t.Fatalf("call = %+v", call)
	}
}

func TestPatchTransactionAppliesToMerchant(t *testing.T) {
	store := &fakeEdits{}
	rec := editCall(newEditServer(store), "PATCH", "/api/transactions/9", `{"category_id":3,"apply_to_merchant":true}`)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d", rec.Code)
	}
	if len(store.categoryCalls) != 1 || !store.categoryCalls[0].apply {
		t.Fatalf("calls = %+v", store.categoryCalls)
	}
}

func TestPatchTransactionClearsCategory(t *testing.T) {
	store := &fakeEdits{}
	rec := editCall(newEditServer(store), "PATCH", "/api/transactions/9", `{"category_id":null,"apply_to_merchant":false}`)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d", rec.Code)
	}
	if len(store.categoryCalls) != 1 || store.categoryCalls[0].categoryID != nil {
		t.Fatalf("calls = %+v", store.categoryCalls)
	}
}

func TestPatchTransactionErrors(t *testing.T) {
	for _, c := range []struct {
		name   string
		path   string
		body   string
		err    error
		status int
	}{
		{name: "unknown row", path: "/api/transactions/99", body: `{"category_id":3}`, err: ledger.ErrNotFound, status: http.StatusNotFound},
		{name: "unknown category", path: "/api/transactions/1", body: `{"category_id":77}`, err: ledger.ErrBadCategory, status: http.StatusUnprocessableEntity},
		{name: "missing category", path: "/api/transactions/1", body: `{"apply_to_merchant":true}`, status: http.StatusUnprocessableEntity},
		{name: "category is text", path: "/api/transactions/1", body: `{"category_id":"three"}`, status: http.StatusUnprocessableEntity},
		{name: "category is zero", path: "/api/transactions/1", body: `{"category_id":0}`, status: http.StatusUnprocessableEntity},
		{name: "body is not json", path: "/api/transactions/1", body: `nope`, status: http.StatusUnprocessableEntity},
		{name: "bad id", path: "/api/transactions/abc", body: `{"category_id":3}`, status: http.StatusBadRequest},
	} {
		store := &fakeEdits{categoryErr: c.err}
		rec := editCall(newEditServer(store), "PATCH", c.path, c.body)
		if rec.Code != c.status {
			t.Fatalf("%s status = %d, want %d", c.name, rec.Code, c.status)
		}
		if c.err != nil && len(store.categoryCalls) != 1 {
			t.Fatalf("%s did not reach the store", c.name)
		}
	}
}

func TestPutMerchantAliasStoresValue(t *testing.T) {
	store := &fakeEdits{}
	rec := editCall(newEditServer(store), "PUT", "/api/merchants/7", `{"alias":"  Rent Agency "}`)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body)
	}
	if len(store.aliasCalls) != 1 {
		t.Fatalf("calls = %+v", store.aliasCalls)
	}
	call := store.aliasCalls[0]
	if call.merchantID != 7 || call.alias == nil || *call.alias != "Rent Agency" {
		t.Fatalf("call = %+v", call)
	}
}

func TestPutMerchantAliasClearsValue(t *testing.T) {
	store := &fakeEdits{}
	if rec := editCall(newEditServer(store), "PUT", "/api/merchants/7", `{"alias":null}`); rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d", rec.Code)
	}
	if len(store.aliasCalls) != 1 || store.aliasCalls[0].alias != nil {
		t.Fatalf("calls = %+v", store.aliasCalls)
	}
}

func TestPutMerchantAliasErrors(t *testing.T) {
	for _, c := range []struct {
		name   string
		path   string
		body   string
		err    error
		status int
	}{
		{name: "unknown merchant", path: "/api/merchants/99", body: `{"alias":"x"}`, err: ledger.ErrNotFound, status: http.StatusNotFound},
		{name: "alias too long", path: "/api/merchants/1", body: `{"alias":"` + strings.Repeat("a", maxAliasLength+1) + `"}`, status: http.StatusUnprocessableEntity},
		{name: "alias is a number", path: "/api/merchants/1", body: `{"alias":4}`, status: http.StatusUnprocessableEntity},
		{name: "alias is blank", path: "/api/merchants/1", body: `{"alias":"   "}`, status: http.StatusUnprocessableEntity},
		{name: "missing alias", path: "/api/merchants/1", body: `{}`, status: http.StatusUnprocessableEntity},
		{name: "body is not json", path: "/api/merchants/1", body: `nope`, status: http.StatusUnprocessableEntity},
		{name: "bad id", path: "/api/merchants/0", body: `{"alias":"x"}`, status: http.StatusBadRequest},
	} {
		store := &fakeEdits{aliasErr: c.err}
		rec := editCall(newEditServer(store), "PUT", c.path, c.body)
		if rec.Code != c.status {
			t.Fatalf("%s status = %d, want %d", c.name, rec.Code, c.status)
		}
		if errors.Is(c.err, ledger.ErrNotFound) && len(store.aliasCalls) != 1 {
			t.Fatalf("%s did not reach the store", c.name)
		}
	}
}

func TestPutMerchantAliasAcceptsMaximumLength(t *testing.T) {
	store := &fakeEdits{}
	body := `{"alias":"` + strings.Repeat("a", maxAliasLength) + `"}`
	if rec := editCall(newEditServer(store), "PUT", "/api/merchants/1", body); rec.Code != http.StatusNoContent {
		t.Fatalf("status = %d", rec.Code)
	}
}
