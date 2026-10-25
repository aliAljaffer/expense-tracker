package reminder

import (
	"bufio"
	"fmt"
	"net"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestDue(t *testing.T) {
	riyadh, err := time.LoadLocation("Asia/Riyadh")
	if err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		name     string
		now      time.Time
		loc      *time.Location
		lastSent string
		want     bool
	}{
		{"not the first", time.Date(2026, 11, 2, 9, 0, 0, 0, time.UTC), time.UTC, "", false},
		{"before the hour", time.Date(2026, 11, 1, 7, 59, 0, 0, time.UTC), time.UTC, "", false},
		{"at the hour", time.Date(2026, 11, 1, 8, 0, 0, 0, time.UTC), time.UTC, "", true},
		{"after the hour", time.Date(2026, 11, 1, 13, 0, 0, 0, time.UTC), time.UTC, "", true},
		{"already sent this month", time.Date(2026, 11, 1, 13, 0, 0, 0, time.UTC), time.UTC, "2026-11", false},
		{"new month", time.Date(2026, 12, 1, 9, 0, 0, 0, time.UTC), time.UTC, "2026-11", true},
		{"timezone boundary due", time.Date(2026, 11, 1, 5, 30, 0, 0, time.UTC), riyadh, "", true},
		{"timezone boundary early", time.Date(2026, 11, 1, 4, 30, 0, 0, time.UTC), riyadh, "", false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := Due(c.now, c.loc, c.lastSent); got != c.want {
				t.Fatalf("Due(%s, %s, %q) = %v, want %v",
					c.now, c.loc, c.lastSent, got, c.want)
			}
		})
	}
}

func TestConfigFromEnv(t *testing.T) {
	t.Setenv("REMINDER_TZ", "")
	if cfg, err := ConfigFromEnv(); err != nil || cfg.Location.String() != "UTC" {
		t.Fatalf("default zone = %v, err = %v", cfg.Location, err)
	}
	t.Setenv("REMINDER_TZ", "Asia/Riyadh")
	if cfg, err := ConfigFromEnv(); err != nil || cfg.Location.String() != "Asia/Riyadh" {
		t.Fatalf("zone = %v, err = %v", cfg.Location, err)
	}
	t.Setenv("REMINDER_TZ", "Mars/Olympus")
	if _, err := ConfigFromEnv(); err == nil {
		t.Fatal("invalid zone did not fail")
	}
}

func TestMailerDisabledSendsNothing(t *testing.T) {
	if err := (Mailer{}).Send("owner@example.com"); err == nil {
		t.Fatal("disabled mailer sent")
	}
}

type smtpMessage struct {
	mailFrom string
	rcptTo   []string
	data     string
}

func startFakeSMTP(t *testing.T) (string, func() smtpMessage) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { ln.Close() })
	var mu sync.Mutex
	msg := smtpMessage{}
	go func() {
		conn, err := ln.Accept()
		if err != nil {
			return
		}
		serveFakeSMTP(conn, &mu, &msg)
	}()
	return ln.Addr().String(), func() smtpMessage {
		mu.Lock()
		defer mu.Unlock()
		return msg
	}
}

func serveFakeSMTP(conn net.Conn, mu *sync.Mutex, msg *smtpMessage) {
	defer conn.Close()
	r := bufio.NewReader(conn)
	write := func(line string) { fmt.Fprintf(conn, "%s\r\n", line) }
	write("220 fake ESMTP")
	for {
		line, err := r.ReadString('\n')
		if err != nil {
			return
		}
		cmd := strings.TrimSpace(line)
		upper := strings.ToUpper(cmd)
		switch {
		case strings.HasPrefix(upper, "EHLO"), strings.HasPrefix(upper, "HELO"):
			write("250-fake")
			write("250 OK")
		case strings.HasPrefix(upper, "MAIL FROM:"):
			mu.Lock()
			msg.mailFrom = strings.TrimSpace(cmd[len("MAIL FROM:"):])
			mu.Unlock()
			write("250 OK")
		case strings.HasPrefix(upper, "RCPT TO:"):
			mu.Lock()
			msg.rcptTo = append(msg.rcptTo, strings.TrimSpace(cmd[len("RCPT TO:"):]))
			mu.Unlock()
			write("250 OK")
		case upper == "DATA":
			write("354 end with a dot")
			var body strings.Builder
			for {
				l, err := r.ReadString('\n')
				if err != nil {
					return
				}
				if strings.TrimSpace(l) == "." {
					break
				}
				body.WriteString(l)
			}
			mu.Lock()
			msg.data = body.String()
			mu.Unlock()
			write("250 OK")
		case upper == "QUIT":
			write("221 bye")
			return
		default:
			write("250 OK")
		}
	}
}

func TestMailerSendsSubjectAndBody(t *testing.T) {
	addr, got := startFakeSMTP(t)
	m := Mailer{Addr: addr, From: "grooszy@example.com"}
	if err := m.Send("owner@example.com"); err != nil {
		t.Fatal(err)
	}
	msg := got()
	if !strings.Contains(msg.mailFrom, "grooszy@example.com") {
		t.Fatalf("MAIL FROM = %q", msg.mailFrom)
	}
	if len(msg.rcptTo) != 1 || !strings.Contains(msg.rcptTo[0], "owner@example.com") {
		t.Fatalf("RCPT TO = %v", msg.rcptTo)
	}
	if !strings.Contains(msg.data, "Subject: "+Subject) {
		t.Fatalf("message = %q", msg.data)
	}
	for _, want := range []string{"1st of the month", "Alinma", "Al Rajhi", "grooszy"} {
		if !strings.Contains(msg.data, want) {
			t.Fatalf("body missing %q: %q", want, msg.data)
		}
	}
	if strings.Contains(msg.data, "\u2014") {
		t.Fatal("body contains an em-dash")
	}
}
