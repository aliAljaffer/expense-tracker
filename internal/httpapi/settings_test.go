package httpapi

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/aliAljaffer/grooszy/internal/auth"
	"github.com/aliAljaffer/grooszy/internal/ledger"
	"github.com/aliAljaffer/grooszy/internal/reminder"
)

type memSettings map[string]string

func (m memSettings) Setting(_ context.Context, key string) (string, error) {
	return m[key], nil
}

func (m memSettings) PutSetting(_ context.Context, key, value string) error {
	m[key] = value
	return nil
}

func newSettingsServer(store settingsStore, mail *reminder.Mailer) http.Handler {
	s := &Server{
		auth:      stubAuth{id: auth.Identity{Subject: "owner"}},
		settings:  store,
		mail:      mail,
		maxUpload: 1 << 20,
		log:       slog.New(slog.NewTextHandler(io.Discard, nil)),
	}
	return s.routes()
}

func settingsCall(t *testing.T, h http.Handler, method, path, body string) *httptest.ResponseRecorder {
	t.Helper()
	var r io.Reader
	if body != "" {
		r = strings.NewReader(body)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(method, path, r))
	return rec
}

func decodeSettings(t *testing.T, rec *httptest.ResponseRecorder) map[string]string {
	t.Helper()
	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("body %q: %v", rec.Body.String(), err)
	}
	return body
}

func TestGetSettingsEmpty(t *testing.T) {
	h := newSettingsServer(memSettings{}, nil)
	rec := settingsCall(t, h, "GET", "/api/settings", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := decodeSettings(t, rec)["reminder_email"]; got != "" {
		t.Fatalf("reminder_email = %q", got)
	}
}

func TestGetSettingsStored(t *testing.T) {
	h := newSettingsServer(memSettings{reminder.EmailKey: "owner@example.com"}, nil)
	rec := settingsCall(t, h, "GET", "/api/settings", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := decodeSettings(t, rec)["reminder_email"]; got != "owner@example.com" {
		t.Fatalf("reminder_email = %q", got)
	}
}

func TestPutSettingsStoresSalaryPayersAlone(t *testing.T) {
	store := memSettings{}
	h := newSettingsServer(store, nil)
	rec := settingsCall(t, h, "PUT", "/api/settings", `{"salary_payers":" Saudi Azm "}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body)
	}
	if got := decodeSettings(t, rec)["salary_payers"]; got != "Saudi Azm" {
		t.Fatalf("salary_payers = %q", got)
	}
	if store[ledger.SalaryPayersKey] != "Saudi Azm" {
		t.Fatalf("stored = %q", store[ledger.SalaryPayersKey])
	}
	if store[reminder.EmailKey] != "" {
		t.Fatalf("email touched: %q", store[reminder.EmailKey])
	}
}

func TestGetSettingsReturnsSalaryPayers(t *testing.T) {
	h := newSettingsServer(memSettings{ledger.SalaryPayersKey: "AZM, ACME"}, nil)
	rec := settingsCall(t, h, "GET", "/api/settings", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := decodeSettings(t, rec)["salary_payers"]; got != "AZM, ACME" {
		t.Fatalf("salary_payers = %q", got)
	}
}

func TestPutSettingsValid(t *testing.T) {
	store := memSettings{}
	h := newSettingsServer(store, nil)
	rec := settingsCall(t, h, "PUT", "/api/settings", `{"reminder_email":"owner@example.com"}`)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body)
	}
	if got := decodeSettings(t, rec)["reminder_email"]; got != "owner@example.com" {
		t.Fatalf("reminder_email = %q", got)
	}
	if store[reminder.EmailKey] != "owner@example.com" {
		t.Fatalf("stored = %q", store[reminder.EmailKey])
	}
}

func TestPutSettingsInvalid(t *testing.T) {
	for _, c := range []struct {
		body string
		want int
	}{
		{`{"reminder_email":"not an email"}`, http.StatusUnprocessableEntity},
		{`{"reminder_email":""}`, http.StatusUnprocessableEntity},
		{`{}`, http.StatusUnprocessableEntity},
		{`not json`, http.StatusBadRequest},
	} {
		store := memSettings{}
		h := newSettingsServer(store, nil)
		rec := settingsCall(t, h, "PUT", "/api/settings", c.body)
		if rec.Code != c.want {
			t.Fatalf("%s status = %d, want %d", c.body, rec.Code, c.want)
		}
		if store[reminder.EmailKey] != "" {
			t.Fatalf("%s stored %q", c.body, store[reminder.EmailKey])
		}
	}
}

func TestTestReminderWithoutAddress(t *testing.T) {
	h := newSettingsServer(memSettings{}, nil)
	rec := settingsCall(t, h, "POST", "/api/settings/reminder/test", "")
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status = %d", rec.Code)
	}
	if got := decodeSettings(t, rec)["error"]; got != "no reminder email set" {
		t.Fatalf("error = %q", got)
	}
}

func TestTestReminderDisabled(t *testing.T) {
	h := newSettingsServer(memSettings{reminder.EmailKey: "owner@example.com"}, &reminder.Mailer{})
	rec := settingsCall(t, h, "POST", "/api/settings/reminder/test", "")
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestTestReminderSends(t *testing.T) {
	addr := startHandlerSMTP(t)
	h := newSettingsServer(memSettings{reminder.EmailKey: "owner@example.com"},
		&reminder.Mailer{Addr: addr, From: "grooszy@example.com"})
	rec := settingsCall(t, h, "POST", "/api/settings/reminder/test", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", rec.Code, rec.Body)
	}
	var body map[string]bool
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil || !body["sent"] {
		t.Fatalf("body = %s, err = %v", rec.Body, err)
	}
}

func TestTestReminderSendFails(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := ln.Addr().String()
	ln.Close()
	h := newSettingsServer(memSettings{reminder.EmailKey: "owner@example.com"},
		&reminder.Mailer{Addr: addr, From: "grooszy@example.com"})
	rec := settingsCall(t, h, "POST", "/api/settings/reminder/test", "")
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status = %d", rec.Code)
	}
}

func startHandlerSMTP(t *testing.T) string {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ln.Close() })
	go func() {
		for {
			conn, err := ln.Accept()
			if err != nil {
				return
			}
			go func() {
				defer conn.Close()
				r := bufio.NewReader(conn)
				write := func(line string) { fmt.Fprintf(conn, "%s\r\n", line) }
				write("220 fake ESMTP")
				for {
					line, err := r.ReadString('\n')
					if err != nil {
						return
					}
					upper := strings.ToUpper(strings.TrimSpace(line))
					switch {
					case strings.HasPrefix(upper, "EHLO"), strings.HasPrefix(upper, "HELO"):
						write("250-fake")
						write("250 OK")
					case upper == "DATA":
						write("354 end with a dot")
						for {
							l, err := r.ReadString('\n')
							if err != nil {
								return
							}
							if strings.TrimSpace(l) == "." {
								break
							}
						}
						write("250 OK")
					case upper == "QUIT":
						write("221 bye")
						return
					default:
						write("250 OK")
					}
				}
			}()
		}
	}()
	return ln.Addr().String()
}
