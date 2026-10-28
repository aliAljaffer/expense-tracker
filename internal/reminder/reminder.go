// Package reminder emails the owner on the first of the month to upload the
// latest bank statements.
package reminder

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net"
	"net/smtp"
	"os"
	"time"
)

const (
	EmailKey    = "reminder_email"
	LastSentKey = "reminder_last_sent"

	sendHour    = 8
	monthLayout = "2006-01"

	Subject = "grooszy: upload your latest statements"
	Body    = "Hello,\n\n" +
		"It is the 1st of the month. Please upload your latest Alinma and Al Rajhi\n" +
		"statements to grooszy so this month's spending stays complete.\n\n" +
		"Thank you."
)

// Config is the reminder schedule and the SMTP server it sends through.
type Config struct {
	Location *time.Location
	Mailer   Mailer
}

// ConfigFromEnv reads REMINDER_TZ and the SMTP_* variables. An invalid zone is
// an error so the API never sends at the wrong hour.
func ConfigFromEnv() (Config, error) {
	name := os.Getenv("REMINDER_TZ")
	if name == "" {
		name = "UTC"
	}
	loc, err := time.LoadLocation(name)
	if err != nil {
		return Config{}, fmt.Errorf("REMINDER_TZ %q is not a valid IANA time zone", name)
	}
	return Config{
		Location: loc,
		Mailer: Mailer{
			Addr: os.Getenv("SMTP_ADDR"),
			User: os.Getenv("SMTP_USER"),
			Pass: os.Getenv("SMTP_PASS"),
			From: os.Getenv("SMTP_FROM"),
		},
	}, nil
}

// Mailer sends plain-text email. An empty Addr disables it.
type Mailer struct {
	Addr string
	User string
	Pass string
	From string
}

func (m Mailer) Enabled() bool { return m.Addr != "" }

func (m Mailer) Send(to string) error {
	if !m.Enabled() {
		return errors.New("email is disabled")
	}
	if m.From == "" {
		return errors.New("SMTP_FROM is not set")
	}
	host, _, err := net.SplitHostPort(m.Addr)
	if err != nil {
		return fmt.Errorf("SMTP_ADDR must be host:port: %w", err)
	}
	var auth smtp.Auth
	if m.User != "" {
		auth = smtp.PlainAuth("", m.User, m.Pass, host)
	}
	msg := "From: " + m.From + "\r\n" +
		"To: " + to + "\r\n" +
		"Subject: " + Subject + "\r\n" +
		"MIME-Version: 1.0\r\n" +
		"Content-Type: text/plain; charset=utf-8\r\n" +
		"\r\n" + Body + "\r\n"
	return smtp.SendMail(m.Addr, auth, m.From, []string{to}, []byte(msg))
}

// Due reports whether the reminder is owed: the first of the month, at or
// after 08:00 in loc, and not already sent this month.
func Due(now time.Time, loc *time.Location, lastSent string) bool {
	local := now.In(loc)
	if local.Day() != 1 || local.Hour() < sendHour {
		return false
	}
	return lastSent != local.Format(monthLayout)
}

type Store interface {
	Setting(ctx context.Context, key string) (string, error)
	PutSetting(ctx context.Context, key, value string) error
	ClaimSetting(ctx context.Context, key, value string) (bool, error)
}

type Reminder struct {
	store Store
	mail  Mailer
	loc   *time.Location
	log   *slog.Logger
}

func New(store Store, cfg Config, log *slog.Logger) *Reminder {
	return &Reminder{store: store, mail: cfg.Mailer, loc: cfg.Location, log: log}
}

// Loop checks hourly. It also checks once at start so a restart on the first
// after 08:00 does not wait for the next tick.
func (r *Reminder) Loop(ctx context.Context) {
	ticker := time.NewTicker(time.Hour)
	defer ticker.Stop()
	r.check(ctx)
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			r.check(ctx)
		}
	}
}

func (r *Reminder) check(ctx context.Context) {
	if !r.mail.Enabled() {
		return
	}
	last, err := r.store.Setting(ctx, LastSentKey)
	if err != nil {
		r.log.Warn("read reminder state failed", "error", err)
		return
	}
	now := time.Now()
	if !Due(now, r.loc, last) {
		return
	}
	to, err := r.store.Setting(ctx, EmailKey)
	if err != nil {
		r.log.Warn("read reminder email failed", "error", err)
		return
	}
	if to == "" {
		return
	}
	month := now.In(r.loc).Format(monthLayout)
	claimed, err := r.store.ClaimSetting(ctx, LastSentKey, month)
	if err != nil {
		r.log.Warn("claim reminder failed", "error", err)
		return
	}
	if !claimed {
		return
	}
	if err := r.mail.Send(to); err != nil {
		if err := r.store.PutSetting(ctx, LastSentKey, last); err != nil {
			r.log.Warn("reset reminder state failed", "error", err)
		}
		r.log.Warn("send monthly reminder failed", "error", err)
		return
	}
	r.log.Info("monthly reminder sent")
}
