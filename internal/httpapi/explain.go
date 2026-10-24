package httpapi

import (
	"errors"
	"io"
	"net/http"
	"time"

	"github.com/aliAljaffer/expense-tracker/internal/auth"
	"github.com/aliAljaffer/expense-tracker/internal/explain"
)

// maxExplainBody caps the explanation request so no statement-sized payload
// can reach the explainer.
const maxExplainBody = 64 << 10

func (s *Server) explainStatus(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
	writeJSON(w, http.StatusOK, s.explain.Status())
}

func (s *Server) explanation(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
	if !s.explain.Enabled() {
		writeError(w, http.StatusConflict, "explainer is disabled")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxExplainBody)
	data, err := io.ReadAll(r.Body)
	if err != nil {
		var tooBig *http.MaxBytesError
		if errors.As(err, &tooBig) {
			writeError(w, http.StatusRequestEntityTooLarge, "body exceeds 64 KiB")
			return
		}
		writeError(w, http.StatusBadRequest, "body could not be read")
		return
	}
	req, err := explain.ParseRequest(data)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	started := time.Now()
	reply, err := s.explain.Explain(r.Context(), req)
	if err != nil {
		// Only the outcome is logged, never the prompt, the reply, or the key.
		s.log.Warn("explain failed", "duration_ms", time.Since(started).Milliseconds())
		writeError(w, http.StatusBadGateway, "explainer call failed")
		return
	}
	s.log.Info("explain ok", "duration_ms", time.Since(started).Milliseconds())
	writeJSON(w, http.StatusOK, reply)
}
