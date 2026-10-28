package httpapi

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/aliAljaffer/grooszy/internal/auth"
	"github.com/aliAljaffer/grooszy/internal/ledger"
)

func (s *Server) readStore(w http.ResponseWriter) *ledger.Store {
	if s.ledger == nil {
		writeError(w, http.StatusServiceUnavailable, "database unavailable")
		return nil
	}
	return s.ledger
}

func (s *Server) accounts(w http.ResponseWriter, r *http.Request, id auth.Identity) {
	store := s.readStore(w)
	if store == nil {
		return
	}
	accounts, err := store.Accounts(r.Context())
	if err != nil {
		s.log.Error("read accounts failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not read accounts")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"accounts": accounts})
}

func (s *Server) monthly(w http.ResponseWriter, r *http.Request, id auth.Identity) {
	store := s.readStore(w)
	if store == nil {
		return
	}
	q := r.URL.Query()
	from, to := q.Get("from"), q.Get("to")
	if (from == "") != (to == "") {
		writeError(w, http.StatusBadRequest, "set from and to together")
		return
	}
	if from == "" {
		now := time.Now()
		from = now.AddDate(0, -11, 0).Format("2006-01")
		to = now.Format("2006-01")
	}
	months, err := store.Monthly(r.Context(), from, to)
	switch {
	case errors.Is(err, ledger.ErrBadFilter):
		writeError(w, http.StatusBadRequest, err.Error())
	case err != nil:
		s.log.Error("read monthly overview failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not read monthly overview")
	default:
		writeJSON(w, http.StatusOK, map[string]any{"months": months})
	}
}

func (s *Server) spendingByTime(w http.ResponseWriter, r *http.Request, id auth.Identity) {
	store := s.readStore(w)
	if store == nil {
		return
	}
	q := r.URL.Query()
	from, to := q.Get("from"), q.Get("to")
	if (from == "") != (to == "") {
		writeError(w, http.StatusBadRequest, "set from and to together")
		return
	}
	if from == "" {
		now := time.Now()
		from = now.AddDate(0, -11, 0).Format("2006-01")
		to = now.Format("2006-01")
	}
	result, err := store.SpendingByTime(r.Context(), from, to)
	switch {
	case errors.Is(err, ledger.ErrBadFilter):
		writeError(w, http.StatusBadRequest, err.Error())
	case err != nil:
		s.log.Error("read spending by time failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not read spending by time")
	default:
		writeJSON(w, http.StatusOK, result)
	}
}

func (s *Server) transactions(w http.ResponseWriter, r *http.Request, id auth.Identity) {
	store := s.readStore(w)
	if store == nil {
		return
	}
	q := r.URL.Query()
	f := ledger.TransactionFilter{
		From:   q.Get("from"),
		To:     q.Get("to"),
		Bucket: q.Get("bucket"),
		Kind:   q.Get("kind"),
	}
	if v := q.Get("account_id"); v != "" {
		accID, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "account_id must be an integer")
			return
		}
		f.AccountID = accID
	}
	if v := q.Get("merchant_id"); v != "" {
		merID, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "merchant_id must be an integer")
			return
		}
		if merID <= 0 {
			writeError(w, http.StatusBadRequest, "merchant_id must be positive")
			return
		}
		f.MerchantID = merID
	}
	if v := q.Get("limit"); v != "" {
		limit, err := strconv.Atoi(v)
		if err != nil {
			writeError(w, http.StatusBadRequest, "limit must be an integer")
			return
		}
		f.Limit = limit
	}
	if v := q.Get("offset"); v != "" {
		offset, err := strconv.Atoi(v)
		if err != nil {
			writeError(w, http.StatusBadRequest, "offset must be an integer")
			return
		}
		f.Offset = offset
	}

	result, err := store.Transactions(r.Context(), f)
	switch {
	case errors.Is(err, ledger.ErrBadFilter):
		writeError(w, http.StatusBadRequest, err.Error())
	case err != nil:
		s.log.Error("read transactions failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not read transactions")
	default:
		writeJSON(w, http.StatusOK, result)
	}
}
