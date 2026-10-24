// Package httpapi exposes the owner-only JSON API. It never logs request
// bodies, statement contents, account numbers or amounts.
package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/aliAljaffer/grooszy/internal/auth"
	"github.com/aliAljaffer/grooszy/internal/explain"
	"github.com/aliAljaffer/grooszy/internal/importer"
	"github.com/aliAljaffer/grooszy/internal/ledger"
)

type Authenticator interface {
	Authenticate(*http.Request) (auth.Identity, error)
}

type Server struct {
	svc       *importer.Service
	ledger    *ledger.Store
	auth      Authenticator
	maxUpload int64
	log       *slog.Logger
	// explain is optional. A nil explainer reports disabled and refuses
	// explanations, so the feature can never go live by accident.
	explain *explain.Explainer
}

func New(svc *importer.Service, led *ledger.Store, a Authenticator, maxUpload int64, ex *explain.Explainer, log *slog.Logger) http.Handler {
	if maxUpload <= 0 {
		maxUpload = 16 << 20
	}
	s := &Server{svc: svc, ledger: led, auth: a, maxUpload: maxUpload, explain: ex, log: log}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.health)
	mux.HandleFunc("GET /readyz", s.ready)
	mux.Handle("GET /api/me", s.protect(s.me))
	mux.Handle("GET /api/accounts", s.protect(s.accounts))
	mux.Handle("GET /api/overview/monthly", s.protect(s.monthly))
	mux.Handle("GET /api/transactions", s.protect(s.transactions))
	mux.Handle("POST /api/imports", s.protect(s.upload))
	mux.Handle("GET /api/imports/{id}", s.protect(s.get))
	mux.Handle("POST /api/imports/{id}/commit", s.protect(s.commit))
	mux.Handle("DELETE /api/imports/{id}", s.protect(s.cancel))
	mux.Handle("GET /api/explainers/status", s.protect(s.explainStatus))
	mux.Handle("POST /api/explanations", s.protect(s.explanation))
	mux.Handle("GET /api/suggestions/card-coverage", s.protect(s.cardCoverage))
	mux.Handle("GET /api/suggestions/recurring", s.protect(s.recurring))
	mux.Handle("GET /api/suggestions/bnpl", s.protect(s.bnpl))
	return http.TimeoutHandler(mux, 90*time.Second, `{"error":"request timed out"}`)
}

func (s *Server) protect(h func(http.ResponseWriter, *http.Request, auth.Identity)) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id, err := s.auth.Authenticate(r)
		if err != nil {
			if errors.Is(err, auth.ErrForbidden) {
				writeError(w, http.StatusForbidden, "not allowed")
				return
			}
			writeError(w, http.StatusUnauthorized, "unauthorized")
			return
		}
		h(w, r, id)
	})
}

func (s *Server) health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (s *Server) ready(w http.ResponseWriter, r *http.Request) {
	if err := s.svc.Ping(r.Context()); err != nil {
		writeError(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

func (s *Server) me(w http.ResponseWriter, r *http.Request, id auth.Identity) {
	writeJSON(w, http.StatusOK, map[string]string{
		"subject": id.Subject,
		"name":    id.Name,
		"email":   id.Email,
	})
}

func (s *Server) upload(w http.ResponseWriter, r *http.Request, id auth.Identity) {
	r.Body = http.MaxBytesReader(w, r.Body, s.maxUpload)
	if err := r.ParseMultipartForm(s.maxUpload); err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			writeError(w, http.StatusRequestEntityTooLarge, "file is too large")
			return
		}
		writeError(w, http.StatusBadRequest, "send one file in the file field")
		return
	}
	file, _, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "send one file in the file field")
		return
	}
	defer file.Close()
	data, err := io.ReadAll(file)
	if err != nil {
		writeError(w, http.StatusBadRequest, "file could not be read")
		return
	}

	preview, err := s.svc.Upload(r.Context(), data)
	switch {
	case errors.Is(err, importer.ErrUnsupported):
		writeError(w, http.StatusUnsupportedMediaType, "only Alinma XLSX and Al Rajhi PDF exports are supported")
		return
	case errors.Is(err, importer.ErrUnreadable):
		writeError(w, http.StatusUnprocessableEntity, "file could not be parsed")
		return
	case errors.Is(err, importer.ErrNoAccount):
		writeError(w, http.StatusUnprocessableEntity, "statement does not identify an account")
		return
	case errors.Is(err, importer.ErrBadPeriod):
		writeError(w, http.StatusUnprocessableEntity, "the statement period could not be read")
		return
	case err != nil:
		s.log.Error("upload failed", "error", err)
		writeError(w, http.StatusInternalServerError, "import failed")
		return
	}

	s.log.Info("import preview", "import_id", preview.ImportID, "rows", len(preview.Rows), "status", preview.Status)
	status := http.StatusOK
	if preview.Status == "rejected" {
		status = http.StatusUnprocessableEntity
	}
	writeJSON(w, status, preview)
}

func (s *Server) get(w http.ResponseWriter, r *http.Request, id auth.Identity) {
	importID, ok := pathID(w, r)
	if !ok {
		return
	}
	preview, err := s.svc.Get(r.Context(), importID)
	switch {
	case errors.Is(err, importer.ErrNotFound):
		writeError(w, http.StatusNotFound, "import not found")
	case errors.Is(err, importer.ErrNoPreview):
		writeError(w, http.StatusGone, "review expired, upload the file again")
	case err != nil:
		s.log.Error("get import failed", "import_id", importID, "error", err)
		writeError(w, http.StatusInternalServerError, "could not read import")
	default:
		writeJSON(w, http.StatusOK, preview)
	}
}

func (s *Server) commit(w http.ResponseWriter, r *http.Request, id auth.Identity) {
	importID, ok := pathID(w, r)
	if !ok {
		return
	}
	var body struct {
		Rows *[]int `json:"rows"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil && !errors.Is(err, io.EOF) {
		writeError(w, http.StatusBadRequest, "body must be JSON with an optional rows array")
		return
	}
	var selected []int
	if body.Rows != nil {
		selected = *body.Rows
	}

	result, err := s.svc.Commit(r.Context(), importID, selected)
	switch {
	case errors.Is(err, importer.ErrNotFound):
		writeError(w, http.StatusNotFound, "import not found")
	case errors.Is(err, importer.ErrNotPending):
		writeError(w, http.StatusConflict, "import is not waiting for review")
	case errors.Is(err, importer.ErrNoPreview):
		writeError(w, http.StatusGone, "review expired, upload the file again")
	case errors.Is(err, importer.ErrBadSelection):
		writeError(w, http.StatusBadRequest, err.Error())
	case err != nil:
		s.log.Error("commit failed", "import_id", importID, "error", err)
		writeError(w, http.StatusInternalServerError, "import could not be stored")
	default:
		s.log.Info("import committed", "import_id", result.ImportID, "inserted", result.Inserted, "skipped", result.Skipped)
		writeJSON(w, http.StatusOK, result)
	}
}

func (s *Server) cancel(w http.ResponseWriter, r *http.Request, id auth.Identity) {
	importID, ok := pathID(w, r)
	if !ok {
		return
	}
	err := s.svc.Cancel(r.Context(), importID)
	switch {
	case errors.Is(err, importer.ErrNotFound):
		writeError(w, http.StatusNotFound, "import not found")
	case err != nil:
		s.log.Error("cancel import failed", "import_id", importID, "error", err)
		writeError(w, http.StatusInternalServerError, "could not cancel import")
	default:
		w.WriteHeader(http.StatusNoContent)
	}
}

func pathID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "invalid import id")
		return 0, false
	}
	return id, true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
