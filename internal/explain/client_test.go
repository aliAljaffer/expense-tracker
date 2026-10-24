package explain

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
)

func validRequest() Request {
	return Request{
		Kind:        "fees",
		AccountKind: "current",
		Period:      Period{Start: "2026-03-01", End: "2026-03-31"},
		Aggregates:  Aggregates{TotalDebit: 2575, TransactionCount: 12, MedianDebit: 100},
	}
}

type capture struct {
	mu      sync.Mutex
	sent    map[string]any
	headers http.Header
}

func (c *capture) get() (map[string]any, http.Header) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.sent, c.headers
}

func captureServer(t *testing.T, respond func(http.ResponseWriter)) (*httptest.Server, *capture) {
	var c capture
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		sent := map[string]any{}
		json.Unmarshal(body, &sent)
		c.mu.Lock()
		c.sent, c.headers = sent, r.Header.Clone()
		c.mu.Unlock()
		respond(w)
	}))
	t.Cleanup(srv.Close)
	return srv, &c
}

func TestOpenAIWireFormat(t *testing.T) {
	srv, got := captureServer(t, func(w http.ResponseWriter) {
		w.Write([]byte(`{"choices":[{"message":{"role":"assistant","content":"Fees stayed flat."}}]}`))
	})
	e := New(Config{Provider: ProviderOpenAI, BaseURL: srv.URL, Model: "m1", APIKey: "k1", Enabled: true})

	reply, err := e.Explain(context.Background(), validRequest())
	if err != nil {
		t.Fatal(err)
	}
	if reply.Text != "Fees stayed flat." || reply.Model != "m1" || reply.Provider != ProviderOpenAI {
		t.Fatalf("reply = %+v", reply)
	}
	sent, headers := got.get()
	if headers.Get("Authorization") != "Bearer k1" {
		t.Fatalf("auth header = %q", headers.Get("Authorization"))
	}
	if sent["model"] != "m1" || sent["max_tokens"] != float64(DefaultMaxOutputTokens) {
		t.Fatalf("openai body = %v", sent)
	}
	msgs, ok := sent["messages"].([]any)
	if !ok || len(msgs) != 2 {
		t.Fatalf("messages = %v", sent["messages"])
	}
	first := msgs[0].(map[string]any)
	if first["role"] != "system" {
		t.Fatalf("first role = %v", first["role"])
	}
	sys := first["content"].(string)
	for _, want := range []string{"may not calculate", "financial advice", "may not invent"} {
		if !strings.Contains(sys, want) {
			t.Fatalf("system prompt missing %q: %s", want, sys)
		}
	}
	user := msgs[1].(map[string]any)["content"].(string)
	if !strings.Contains(user, `"total_debit":2575`) {
		t.Fatalf("user prompt = %s", user)
	}
}

func TestAnthropicWireFormat(t *testing.T) {
	srv, got := captureServer(t, func(w http.ResponseWriter) {
		w.Write([]byte(`{"content":[{"type":"text","text":"One fee, small."}]}`))
	})
	e := New(Config{Provider: ProviderAnthropic, BaseURL: srv.URL, Model: "m2", APIKey: "k2", Enabled: true})

	reply, err := e.Explain(context.Background(), validRequest())
	if err != nil {
		t.Fatal(err)
	}
	if reply.Text != "One fee, small." || reply.Model != "m2" || reply.Provider != ProviderAnthropic {
		t.Fatalf("reply = %+v", reply)
	}
	sent, headers := got.get()
	if headers.Get("x-api-key") != "k2" {
		t.Fatalf("api key header = %q", headers.Get("x-api-key"))
	}
	if headers.Get("anthropic-version") == "" {
		t.Fatal("missing anthropic-version header")
	}
	if sent["model"] != "m2" || sent["max_tokens"] != float64(DefaultMaxOutputTokens) {
		t.Fatalf("anthropic body = %v", sent)
	}
	sys, ok := sent["system"].(string)
	if !ok || !strings.Contains(sys, "may not calculate") {
		t.Fatalf("system = %v", sent["system"])
	}
	msgs := sent["messages"].([]any)
	if len(msgs) != 1 {
		t.Fatalf("messages = %v", msgs)
	}
	msg := msgs[0].(map[string]any)
	if msg["role"] != "user" {
		t.Fatalf("role = %v", msg["role"])
	}
	if content := msg["content"].(string); !strings.Contains(content, `"kind":"fees"`) {
		t.Fatalf("content = %s", content)
	}
}

func TestProviderHTTP500Fails(t *testing.T) {
	for _, provider := range []string{ProviderOpenAI, ProviderAnthropic} {
		srv, _ := captureServer(t, func(w http.ResponseWriter) {
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"error":"upstream down"}`))
		})
		e := New(Config{Provider: provider, BaseURL: srv.URL, Model: "m", APIKey: "k", Enabled: true})
		_, err := e.Explain(context.Background(), validRequest())
		if err == nil || !strings.Contains(err.Error(), "status 500") {
			t.Fatalf("%s err = %v", provider, err)
		}
	}
}

func TestDisabledExplainerRefuses(t *testing.T) {
	e := New(Config{})
	if e == nil || e.Enabled() {
		t.Fatal("disabled explainer reports enabled")
	}
	if _, err := e.Explain(context.Background(), validRequest()); !errors.Is(err, ErrDisabled) {
		t.Fatalf("err = %v", err)
	}
	if st := e.Status(); st.Enabled || st.Provider != "" || st.Model != "" {
		t.Fatalf("status = %+v", st)
	}
}

func TestBaseURLSuffixIsKept(t *testing.T) {
	var mu sync.Mutex
	path := ""
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		path = r.URL.Path
		mu.Unlock()
		w.Write([]byte(`{"choices":[{"message":{"content":"ok"}}]}`))
	}))
	defer srv.Close()
	e := New(Config{Provider: ProviderOpenAI, BaseURL: srv.URL + "/api/v1", Model: "m", APIKey: "k", Enabled: true})
	if _, err := e.Explain(context.Background(), validRequest()); err != nil {
		t.Fatal(err)
	}
	mu.Lock()
	defer mu.Unlock()
	if path != "/api/v1/chat/completions" {
		t.Fatalf("path = %q", path)
	}
}

func TestBaseURLSuffixIsKeptForAnthropic(t *testing.T) {
	var mu sync.Mutex
	path := ""
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		path = r.URL.Path
		mu.Unlock()
		w.Write([]byte(`{"content":[{"type":"text","text":"ok"}]}`))
	}))
	defer srv.Close()
	e := New(Config{Provider: ProviderAnthropic, BaseURL: srv.URL + "/api/v1", Model: "m", APIKey: "k", Enabled: true})
	if _, err := e.Explain(context.Background(), validRequest()); err != nil {
		t.Fatal(err)
	}
	mu.Lock()
	defer mu.Unlock()
	if path != "/api/v1/v1/messages" {
		t.Fatalf("path = %q", path)
	}
}
