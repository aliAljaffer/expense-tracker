package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"unicode/utf8"

	"github.com/aliAljaffer/grooszy/internal/auth"
	"github.com/aliAljaffer/grooszy/internal/ledger"
)

const maxAliasLength = 120

type editStore interface {
	Categories(ctx context.Context) ([]ledger.Category, error)
	SetCategory(ctx context.Context, transactionID int64, categoryID *int64, applyToMerchant bool) error
	SetMerchantAlias(ctx context.Context, merchantID int64, alias *string) error
}

func (s *Server) editStore(w http.ResponseWriter) editStore {
	if s.edits == nil {
		writeError(w, http.StatusServiceUnavailable, "database unavailable")
		return nil
	}
	return s.edits
}

func (s *Server) categories(w http.ResponseWriter, r *http.Request, id auth.Identity) {
	store := s.editStore(w)
	if store == nil {
		return
	}
	categories, err := store.Categories(r.Context())
	if err != nil {
		s.log.Error("read categories failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not read categories")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"categories": categories})
}

func (s *Server) patchTransaction(w http.ResponseWriter, r *http.Request, id auth.Identity) {
	store := s.editStore(w)
	if store == nil {
		return
	}
	transactionID, ok := pathID(w, r, "transaction")
	if !ok {
		return
	}
	var body struct {
		CategoryID      json.RawMessage `json:"category_id"`
		ApplyToMerchant bool            `json:"apply_to_merchant"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&body); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "body must be JSON with category_id")
		return
	}
	if len(body.CategoryID) == 0 {
		writeError(w, http.StatusUnprocessableEntity, "category_id is required")
		return
	}
	categoryID, ok := nullableID(w, body.CategoryID)
	if !ok {
		return
	}

	err := store.SetCategory(r.Context(), transactionID, categoryID, body.ApplyToMerchant)
	switch {
	case errors.Is(err, ledger.ErrNotFound):
		writeError(w, http.StatusNotFound, "transaction not found")
	case errors.Is(err, ledger.ErrBadCategory):
		writeError(w, http.StatusUnprocessableEntity, "unknown category")
	case err != nil:
		s.log.Error("update category failed", "transaction_id", transactionID, "error", err)
		writeError(w, http.StatusInternalServerError, "could not update category")
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}

func (s *Server) putMerchantAlias(w http.ResponseWriter, r *http.Request, id auth.Identity) {
	store := s.editStore(w)
	if store == nil {
		return
	}
	merchantID, ok := pathID(w, r, "merchant")
	if !ok {
		return
	}
	var body struct {
		Alias json.RawMessage `json:"alias"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<16)).Decode(&body); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "body must be JSON with alias")
		return
	}
	if len(body.Alias) == 0 {
		writeError(w, http.StatusUnprocessableEntity, "alias is required")
		return
	}
	var alias *string
	if string(body.Alias) != "null" {
		var value string
		if err := json.Unmarshal(body.Alias, &value); err != nil {
			writeError(w, http.StatusUnprocessableEntity, "alias must be a string or null")
			return
		}
		value = strings.TrimSpace(value)
		if value == "" {
			writeError(w, http.StatusUnprocessableEntity, "alias must not be blank")
			return
		}
		if utf8.RuneCountInString(value) > maxAliasLength {
			writeError(w, http.StatusUnprocessableEntity, "alias is longer than 120 characters")
			return
		}
		alias = &value
	}

	err := store.SetMerchantAlias(r.Context(), merchantID, alias)
	switch {
	case errors.Is(err, ledger.ErrNotFound):
		writeError(w, http.StatusNotFound, "merchant not found")
	case err != nil:
		s.log.Error("update merchant alias failed", "merchant_id", merchantID, "error", err)
		writeError(w, http.StatusInternalServerError, "could not update merchant alias")
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}

func nullableID(w http.ResponseWriter, raw json.RawMessage) (*int64, bool) {
	if string(raw) == "null" {
		return nil, true
	}
	var value int64
	if err := json.Unmarshal(raw, &value); err != nil || value <= 0 {
		writeError(w, http.StatusUnprocessableEntity, "category_id must be a positive integer or null")
		return nil, false
	}
	return &value, true
}
