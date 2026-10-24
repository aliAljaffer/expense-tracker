// Package explain turns aggregates the app already computed into short prose
// with an optional large language model. The feature is read-only: the model
// sees no personal data, its output is never stored, and no score or money
// figure can change because of it.
package explain

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strconv"
	"time"
)

const (
	ProviderOpenAI    = "openai"
	ProviderAnthropic = "anthropic"

	DefaultTimeout         = 30 * time.Second
	DefaultMaxOutputTokens = 512
)

var ErrDisabled = errors.New("explainer is disabled")

type Config struct {
	Provider        string
	BaseURL         string
	Model           string
	APIKey          string
	Enabled         bool
	Timeout         time.Duration
	MaxOutputTokens int
}

// ConfigFromEnv reads the EXPENSE_EXPLAIN_* variables. Enabled is true only
// when a base URL, a model, and an API key are all set.
func ConfigFromEnv() Config {
	c := Config{
		Provider:        os.Getenv("EXPENSE_EXPLAIN_PROVIDER"),
		BaseURL:         os.Getenv("EXPENSE_EXPLAIN_BASE_URL"),
		Model:           os.Getenv("EXPENSE_EXPLAIN_MODEL"),
		APIKey:          os.Getenv("EXPENSE_EXPLAIN_API_KEY"),
		Timeout:         DefaultTimeout,
		MaxOutputTokens: DefaultMaxOutputTokens,
	}
	if c.Provider == "" {
		c.Provider = ProviderOpenAI
	}
	if v := os.Getenv("EXPENSE_EXPLAIN_TIMEOUT"); v != "" {
		if s, err := strconv.Atoi(v); err == nil && s > 0 {
			c.Timeout = time.Duration(s) * time.Second
		}
	}
	c.Enabled = c.BaseURL != "" && c.Model != "" && c.APIKey != ""
	return c
}

// New returns nil for an unknown provider or a disabled config, which callers
// treat as a missing explainer.
func New(cfg Config) *Explainer {
	if cfg.Timeout <= 0 {
		cfg.Timeout = DefaultTimeout
	}
	if cfg.MaxOutputTokens <= 0 {
		cfg.MaxOutputTokens = DefaultMaxOutputTokens
	}
	if cfg.Provider == "" {
		cfg.Provider = ProviderOpenAI
	}
	var client wireClient
	switch cfg.Provider {
	case ProviderOpenAI:
		client = openaiClient{}
	case ProviderAnthropic:
		client = anthropicClient{}
	default:
		return nil
	}
	return &Explainer{cfg: cfg, client: client, http: &http.Client{Timeout: cfg.Timeout}}
}

// Period and Aggregates are the only figures the model is ever shown.
type Period struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

type Aggregates struct {
	TotalDebit       int64 `json:"total_debit,omitempty"`
	TotalCredit      int64 `json:"total_credit,omitempty"`
	TransactionCount int64 `json:"transaction_count,omitempty"`
	SpendingCount    int64 `json:"spending_count,omitempty"`
	LargestDebit     int64 `json:"largest_debit,omitempty"`
	MedianDebit      int64 `json:"median_debit,omitempty"`
	HistoryRows      int64 `json:"history_rows,omitempty"`
}

type Request struct {
	Kind        string     `json:"kind"`
	AccountKind string     `json:"account_kind,omitempty"`
	Period      Period     `json:"period"`
	Aggregates  Aggregates `json:"aggregates"`
}

var (
	allowedKinds        = map[string]bool{"duplicate": true, "anomaly": true, "recurring": true, "fees": true, "cash_flow": true}
	allowedAccountKinds = map[string]bool{"": true, "current": true, "savings": true, "credit_card": true}
	topKeys             = map[string]bool{"kind": true, "account_kind": true, "period": true, "aggregates": true}
	periodKeys          = map[string]bool{"start": true, "end": true}
	aggregateKeys       = map[string]bool{
		"total_debit":       true,
		"total_credit":      true,
		"transaction_count": true,
		"spending_count":    true,
		"largest_debit":     true,
		"median_debit":      true,
		"history_rows":      true,
	}
)

// ParseRequest validates a request body against the field allowlist and
// returns an error naming the first field outside it.
func ParseRequest(body []byte) (Request, error) {
	var top map[string]json.RawMessage
	dec := json.NewDecoder(bytes.NewReader(body))
	if err := dec.Decode(&top); err != nil {
		return Request{}, errors.New("body must be a JSON object")
	}
	if dec.More() {
		return Request{}, errors.New("body must be a single JSON object")
	}
	if bad := firstUnknownKey(top, topKeys); bad != "" {
		return Request{}, fmt.Errorf("field %q is not allowed", bad)
	}

	var req Request
	if raw, ok := top["period"]; ok && string(raw) != "null" {
		fields, err := rawObject(raw, `field "period" must be an object`)
		if err != nil {
			return Request{}, err
		}
		if bad := firstUnknownKey(fields, periodKeys); bad != "" {
			return Request{}, fmt.Errorf("field %q is not allowed", "period."+bad)
		}
		targets := map[string]any{"start": &req.Period.Start, "end": &req.Period.End}
		for _, key := range sortedKeys(fields) {
			if err := json.Unmarshal(fields[key], targets[key]); err != nil {
				return Request{}, fmt.Errorf("field %q must be a string", "period."+key)
			}
		}
	}
	if raw, ok := top["aggregates"]; ok && string(raw) != "null" {
		fields, err := rawObject(raw, `field "aggregates" must be an object`)
		if err != nil {
			return Request{}, err
		}
		if bad := firstUnknownKey(fields, aggregateKeys); bad != "" {
			return Request{}, fmt.Errorf("field %q is not allowed", "aggregates."+bad)
		}
		targets := map[string]any{
			"total_debit":       &req.Aggregates.TotalDebit,
			"total_credit":      &req.Aggregates.TotalCredit,
			"transaction_count": &req.Aggregates.TransactionCount,
			"spending_count":    &req.Aggregates.SpendingCount,
			"largest_debit":     &req.Aggregates.LargestDebit,
			"median_debit":      &req.Aggregates.MedianDebit,
			"history_rows":      &req.Aggregates.HistoryRows,
		}
		for _, key := range sortedKeys(fields) {
			if err := json.Unmarshal(fields[key], targets[key]); err != nil {
				return Request{}, fmt.Errorf("field %q must be an integer", "aggregates."+key)
			}
		}
	}
	if raw, ok := top["kind"]; ok {
		if err := json.Unmarshal(raw, &req.Kind); err != nil {
			return Request{}, fmt.Errorf("field %q must be a string", "kind")
		}
	}
	if raw, ok := top["account_kind"]; ok {
		if err := json.Unmarshal(raw, &req.AccountKind); err != nil {
			return Request{}, fmt.Errorf("field %q must be a string", "account_kind")
		}
	}

	if !allowedKinds[req.Kind] {
		return Request{}, fmt.Errorf("unsupported kind %q", req.Kind)
	}
	if !allowedAccountKinds[req.AccountKind] {
		return Request{}, fmt.Errorf("unsupported account_kind %q", req.AccountKind)
	}
	if _, err := time.Parse(time.DateOnly, req.Period.Start); err != nil {
		return Request{}, errors.New(`field "period.start" must be a date formatted YYYY-MM-DD`)
	}
	if _, err := time.Parse(time.DateOnly, req.Period.End); err != nil {
		return Request{}, errors.New(`field "period.end" must be a date formatted YYYY-MM-DD`)
	}
	return req, nil
}

func rawObject(raw json.RawMessage, msg string) (map[string]json.RawMessage, error) {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &fields); err != nil {
		return nil, errors.New(msg)
	}
	return fields, nil
}

func firstUnknownKey(fields map[string]json.RawMessage, allow map[string]bool) string {
	var extra []string
	for key := range fields {
		if !allow[key] {
			extra = append(extra, key)
		}
	}
	if len(extra) == 0 {
		return ""
	}
	sort.Strings(extra)
	return extra[0]
}

func sortedKeys(m map[string]json.RawMessage) []string {
	keys := make([]string, 0, len(m))
	for key := range m {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

// systemInstruction is fixed. The model may not compute anything: every
// number it mentions must come from the app, and it never gives advice.
const systemInstruction = "You explain spending figures that grooszy already computed. " +
	"You may not calculate, may not give financial advice, and may not invent figures. " +
	"Every figure you mention comes from the input the app sent. " +
	"Amounts are integer halalas: 2575 is 25.75 riyals. " +
	"Write two or three sentences of plain English."

type Explainer struct {
	cfg    Config
	client wireClient
	http   *http.Client
}

// Enabled is nil-safe so a missing explainer reports disabled.
func (e *Explainer) Enabled() bool { return e != nil && e.cfg.Enabled }

type Status struct {
	Enabled  bool   `json:"enabled"`
	Provider string `json:"provider"`
	Model    string `json:"model"`
}

// Status never carries the API key or the base URL. A disabled explainer
// reports nothing about its settings.
func (e *Explainer) Status() Status {
	if !e.Enabled() {
		return Status{}
	}
	return Status{Enabled: true, Provider: e.cfg.Provider, Model: e.cfg.Model}
}

type Reply struct {
	Text     string `json:"text"`
	Model    string `json:"model"`
	Provider string `json:"provider"`
}

// Explain sends only the allowlisted request fields and returns prose. The
// reply is never written anywhere else.
func (e *Explainer) Explain(ctx context.Context, req Request) (Reply, error) {
	if !e.Enabled() {
		return Reply{}, ErrDisabled
	}
	user, err := json.Marshal(req)
	if err != nil {
		return Reply{}, err
	}
	text, err := e.client.Complete(ctx, e.http, e.cfg, systemInstruction, string(user))
	if err != nil {
		return Reply{}, err
	}
	return Reply{Text: text, Model: e.cfg.Model, Provider: e.cfg.Provider}, nil
}

type wireClient interface {
	Complete(ctx context.Context, hc *http.Client, cfg Config, system, user string) (string, error)
}

// deliver sends one call and rejects anything outside a 2xx status. The
// provider's error body is never returned or logged.
func deliver(hc *http.Client, req *http.Request) ([]byte, error) {
	resp, err := hc.Do(req)
	if err != nil {
		return nil, errors.New("provider could not be reached")
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("provider returned status %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return nil, errors.New("provider response unreadable")
	}
	return data, nil
}
