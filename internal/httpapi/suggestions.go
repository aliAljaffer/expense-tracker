package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/aliAljaffer/grooszy/internal/auth"
	"github.com/aliAljaffer/grooszy/internal/ledger"
)

// suggestionReads maps the URL name to the ledger query behind it.
var suggestionReads = map[string]func(*ledger.Store, context.Context, string, string) (any, error){
	"card-coverage": func(s *ledger.Store, ctx context.Context, from, to string) (any, error) {
		return s.CardCoverage(ctx, from, to)
	},
	"recurring": func(s *ledger.Store, ctx context.Context, from, to string) (any, error) {
		return s.Recurring(ctx, from, to)
	},
	"bnpl": func(s *ledger.Store, ctx context.Context, from, to string) (any, error) {
		return s.BNPL(ctx, from, to)
	},
	"salary-trend": func(s *ledger.Store, ctx context.Context, from, to string) (any, error) {
		return s.SalaryTrend(ctx, from, to)
	},
	"transfer-matches": func(s *ledger.Store, ctx context.Context, from, to string) (any, error) {
		return s.TransferMatches(ctx, from, to)
	},
}

func (s *Server) suggestionRead(name string) func(http.ResponseWriter, *http.Request, auth.Identity) {
	return func(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
		store := s.readStore(w)
		if store == nil {
			return
		}
		from, to, ok := monthWindow(w, r)
		if !ok {
			return
		}
		result, err := suggestionReads[name](store, r.Context(), from, to)
		switch {
		case errors.Is(err, ledger.ErrBadFilter):
			writeError(w, http.StatusBadRequest, err.Error())
		case err != nil:
			s.log.Error("read suggestion failed", "suggestion", name, "error", err)
			writeError(w, http.StatusInternalServerError, "could not read the suggestion")
		default:
			writeJSON(w, http.StatusOK, result)
		}
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
