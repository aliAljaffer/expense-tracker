package httpapi

import (
	"errors"
	"net/http"
	"time"

	"github.com/aliAljaffer/expense-tracker/internal/auth"
	"github.com/aliAljaffer/expense-tracker/internal/ledger"
)

func (s *Server) cardCoverage(w http.ResponseWriter, r *http.Request, id auth.Identity) {
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
	result, err := store.CardCoverage(r.Context(), from, to)
	switch {
	case errors.Is(err, ledger.ErrBadFilter):
		writeError(w, http.StatusBadRequest, err.Error())
	case err != nil:
		s.log.Error("read card coverage failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not read card coverage")
	default:
		writeJSON(w, http.StatusOK, result)
	}
}

func (s *Server) recurring(w http.ResponseWriter, r *http.Request, id auth.Identity) {
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
	result, err := store.Recurring(r.Context(), from, to)
	switch {
	case errors.Is(err, ledger.ErrBadFilter):
		writeError(w, http.StatusBadRequest, err.Error())
	case err != nil:
		s.log.Error("read recurring failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not read recurring")
	default:
		writeJSON(w, http.StatusOK, result)
	}
}

func (s *Server) bnpl(w http.ResponseWriter, r *http.Request, id auth.Identity) {
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
	result, err := store.BNPL(r.Context(), from, to)
	switch {
	case errors.Is(err, ledger.ErrBadFilter):
		writeError(w, http.StatusBadRequest, err.Error())
	case err != nil:
		s.log.Error("read bnpl failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not read bnpl")
	default:
		writeJSON(w, http.StatusOK, result)
	}
}
