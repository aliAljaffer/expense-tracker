package httpapi

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/mail"
	"strings"

	"github.com/aliAljaffer/grooszy/internal/auth"
	"github.com/aliAljaffer/grooszy/internal/ledger"
	"github.com/aliAljaffer/grooszy/internal/reminder"
)

type settingsStore interface {
	Setting(ctx context.Context, key string) (string, error)
	PutSetting(ctx context.Context, key, value string) error
}

func (s *Server) settingsStore(w http.ResponseWriter) settingsStore {
	if s.settings == nil {
		writeError(w, http.StatusServiceUnavailable, "database unavailable")
		return nil
	}
	return s.settings
}

func (s *Server) getSettings(w http.ResponseWriter, r *http.Request, id auth.Identity) {
	store := s.settingsStore(w)
	if store == nil {
		return
	}
	email, err := store.Setting(r.Context(), reminder.EmailKey)
	if err != nil {
		s.log.Error("read settings failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not read settings")
		return
	}
	payers, err := store.Setting(r.Context(), ledger.SalaryPayersKey)
	if err != nil {
		s.log.Error("read settings failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not read settings")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"reminder_email": email,
		"salary_payers":  payers,
	})
}

func (s *Server) putSettings(w http.ResponseWriter, r *http.Request, id auth.Identity) {
	store := s.settingsStore(w)
	if store == nil {
		return
	}
	var body struct {
		ReminderEmail *string `json:"reminder_email"`
		SalaryPayers  *string `json:"salary_payers"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 1<<20)).Decode(&body); err != nil {
		writeError(w, http.StatusBadRequest, "body must be JSON with reminder_email or salary_payers")
		return
	}
	if body.ReminderEmail == nil && body.SalaryPayers == nil {
		writeError(w, http.StatusUnprocessableEntity, "set reminder_email or salary_payers")
		return
	}
	out := map[string]string{}
	if body.ReminderEmail != nil {
		email := strings.TrimSpace(*body.ReminderEmail)
		if email == "" {
			writeError(w, http.StatusUnprocessableEntity, "reminder email is required")
			return
		}
		addr, err := mail.ParseAddress(email)
		if err != nil {
			writeError(w, http.StatusUnprocessableEntity, "reminder email is not valid")
			return
		}
		if err := store.PutSetting(r.Context(), reminder.EmailKey, addr.Address); err != nil {
			s.log.Error("write settings failed", "error", err)
			writeError(w, http.StatusInternalServerError, "could not store settings")
			return
		}
		out["reminder_email"] = addr.Address
	}
	if body.SalaryPayers != nil {
		payers := strings.TrimSpace(*body.SalaryPayers)
		if err := store.PutSetting(r.Context(), ledger.SalaryPayersKey, payers); err != nil {
			s.log.Error("write settings failed", "error", err)
			writeError(w, http.StatusInternalServerError, "could not store settings")
			return
		}
		out["salary_payers"] = payers
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) testReminder(w http.ResponseWriter, r *http.Request, id auth.Identity) {
	store := s.settingsStore(w)
	if store == nil {
		return
	}
	email, err := store.Setting(r.Context(), reminder.EmailKey)
	if err != nil {
		s.log.Error("read reminder email failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not read settings")
		return
	}
	if email == "" {
		writeError(w, http.StatusUnprocessableEntity, "no reminder email set")
		return
	}
	if s.mail == nil || !s.mail.Enabled() {
		writeError(w, http.StatusBadGateway, "email is disabled")
		return
	}
	if err := s.mail.Send(email); err != nil {
		s.log.Warn("send test reminder failed", "error", err)
		writeError(w, http.StatusBadGateway, "email could not be sent")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"sent": true})
}
