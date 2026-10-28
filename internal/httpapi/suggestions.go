package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/aliAljaffer/grooszy/internal/auth"
	"github.com/aliAljaffer/grooszy/internal/ledger"
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

func (s *Server) salaryTrend(w http.ResponseWriter, r *http.Request, id auth.Identity) {
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
	result, err := store.SalaryTrend(r.Context(), from, to)
	switch {
	case errors.Is(err, ledger.ErrBadFilter):
		writeError(w, http.StatusBadRequest, err.Error())
	case err != nil:
		s.log.Error("read salary trend failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not read salary trend")
	default:
		writeJSON(w, http.StatusOK, result)
	}
}

func (s *Server) transferMatches(w http.ResponseWriter, r *http.Request, id auth.Identity) {
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
	result, err := store.TransferMatches(r.Context(), from, to)
	switch {
	case errors.Is(err, ledger.ErrBadFilter):
		writeError(w, http.StatusBadRequest, err.Error())
	case err != nil:
		s.log.Error("read transfer matches failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not read transfer matches")
	default:
		writeJSON(w, http.StatusOK, result)
	}
}

var suggestionDecisionKinds = map[string]string{
	"card-coverage":    ledger.SuggestionCardCoverage,
	"recurring":        ledger.SuggestionRecurring,
	"bnpl":             ledger.SuggestionBNPL,
	"salary-trend":     ledger.SuggestionSalaryTrend,
	"transfer-matches": ledger.SuggestionTransferMatches,
}

func (s *Server) putSuggestionDecision(w http.ResponseWriter, r *http.Request, id auth.Identity) {
	kind, ok := suggestionDecisionKinds[r.PathValue("kind")]
	if !ok {
		writeError(w, http.StatusUnprocessableEntity, "unknown suggestion kind")
		return
	}
	var body struct {
		Decision string `json:"decision"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil ||
		!ledger.ValidSuggestionDecision(body.Decision) {
		writeError(w, http.StatusUnprocessableEntity, "decision must be dismissed or acknowledged")
		return
	}
	store := s.readStore(w)
	if store == nil {
		return
	}
	if err := store.SetSuggestionDecision(r.Context(), kind, body.Decision); err != nil {
		s.log.Error("store suggestion decision failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not store the decision")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"decision": body.Decision})
}

func (s *Server) clearSuggestionDecision(w http.ResponseWriter, r *http.Request, id auth.Identity) {
	kind, ok := suggestionDecisionKinds[r.PathValue("kind")]
	if !ok {
		writeError(w, http.StatusUnprocessableEntity, "unknown suggestion kind")
		return
	}
	store := s.readStore(w)
	if store == nil {
		return
	}
	if err := store.ClearSuggestionDecision(r.Context(), kind); err != nil {
		s.log.Error("clear suggestion decision failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not clear the decision")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
