package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/aliAljaffer/grooszy/internal/auth"
	"github.com/aliAljaffer/grooszy/internal/explain"
	"github.com/aliAljaffer/grooszy/internal/ledger"
)

const (
	chatMaxMessages = 8
	chatMaxContent  = 2000
	chatBodyLimit   = 64 << 10
	chatWindow      = 6
	chatNoDataReply = "I have no spending data yet. Import a statement and ask me again."
)

// chatReader is the aggregate slice of the ledger the chat endpoint reads.
// Row-level queries are deliberately absent.
type chatReader interface {
	Monthly(ctx context.Context, fromMonth, toMonth string) ([]ledger.Month, error)
	CardCoverage(ctx context.Context, fromMonth, toMonth string) (ledger.CardCoverageResult, error)
	Recurring(ctx context.Context, fromMonth, toMonth string) (ledger.RecurringResult, error)
	BNPL(ctx context.Context, fromMonth, toMonth string) (ledger.BNPLResult, error)
}

type chatRequest struct {
	Messages *[]explain.ChatMessage `json:"messages"`
}

func (s *Server) chat(w http.ResponseWriter, r *http.Request, _ auth.Identity) {
	if !s.explain.Enabled() {
		writeError(w, http.StatusServiceUnavailable, "chat is not configured")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, chatBodyLimit)
	body, err := io.ReadAll(r.Body)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, "body could not be read")
		return
	}
	messages, err := parseChat(body)
	if err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	store := s.chatLedger
	if store == nil {
		writeError(w, http.StatusServiceUnavailable, "database unavailable")
		return
	}

	now := time.Now()
	from := now.AddDate(0, -(chatWindow - 1), 0).Format("2006-01")
	to := now.Format("2006-01")
	months, err := store.Monthly(r.Context(), from, to)
	if err != nil {
		s.log.Error("chat summary failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not read the summary")
		return
	}
	if len(months) == 0 {
		writeJSON(w, http.StatusOK, map[string]string{"reply": chatNoDataReply})
		return
	}
	card, err := store.CardCoverage(r.Context(), from, to)
	if err != nil {
		s.log.Error("chat card coverage failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not read the summary")
		return
	}
	recurring, err := store.Recurring(r.Context(), from, to)
	if err != nil {
		s.log.Error("chat recurring failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not read the summary")
		return
	}
	bnpl, err := store.BNPL(r.Context(), from, to)
	if err != nil {
		s.log.Error("chat bnpl failed", "error", err)
		writeError(w, http.StatusInternalServerError, "could not read the summary")
		return
	}

	started := time.Now()
	reply, err := s.explain.Answer(r.Context(), explain.NewChatSummary(months, card, recurring, bnpl), messages)
	if err != nil || strings.TrimSpace(reply) == "" {
		s.log.Warn("chat answer failed", "duration_ms", time.Since(started).Milliseconds())
		writeError(w, http.StatusBadGateway, "the model did not answer")
		return
	}
	s.log.Info("chat answered", "duration_ms", time.Since(started).Milliseconds())
	writeJSON(w, http.StatusOK, map[string]string{"reply": reply})
}

// parseChat enforces the message shape. The client can never send a system
// turn: only the handler's fixed instruction reaches the model.
func parseChat(body []byte) ([]explain.ChatMessage, error) {
	var req chatRequest
	dec := json.NewDecoder(bytes.NewReader(body))
	if err := dec.Decode(&req); err != nil {
		return nil, errors.New(`body must be a JSON object with a messages array`)
	}
	if dec.More() {
		return nil, errors.New("body must be a single JSON object")
	}
	if req.Messages == nil {
		return nil, errors.New(`field "messages" is required`)
	}
	messages := *req.Messages
	if len(messages) < 1 || len(messages) > chatMaxMessages {
		return nil, fmt.Errorf("messages must hold 1 to %d turns", chatMaxMessages)
	}
	for i, m := range messages {
		switch m.Role {
		case "user", "assistant":
		default:
			return nil, fmt.Errorf("message %d has an unsupported role %q", i+1, m.Role)
		}
		if strings.TrimSpace(m.Content) == "" {
			return nil, fmt.Errorf("message %d is empty", i+1)
		}
		if utf8.RuneCountInString(m.Content) > chatMaxContent {
			return nil, fmt.Errorf("message %d exceeds %d characters", i+1, chatMaxContent)
		}
	}
	if messages[len(messages)-1].Role != "user" {
		return nil, errors.New("the last message must come from the user")
	}
	return messages, nil
}
