package explain

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCentralAnswerSendsThePacketAndConversation(t *testing.T) {
	var got centralRequest
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/v1/chat" {
			t.Errorf("request = %s %s", r.Method, r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer test-key" {
			t.Errorf("authorization = %q", r.Header.Get("Authorization"))
		}
		if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
			t.Errorf("decode: %v", err)
		}
		io.WriteString(w, `{"reply":" You spent 3,500.00 SAR in May. "}`)
	}))
	defer srv.Close()

	c := &Central{baseURL: srv.URL, apiKey: "test-key", http: srv.Client()}
	summary := ChatSummary{Months: []ChatMonth{{Month: "2026-05", Spending: "3,500.00 SAR"}}}
	reply, err := c.Answer(context.Background(), summary, []ChatMessage{{Role: "user", Content: "How much did I spend in May?"}})
	if err != nil {
		t.Fatal(err)
	}
	if reply != "You spent 3,500.00 SAR in May." {
		t.Fatalf("reply = %q", reply)
	}
	if len(got.Messages) != 1 || got.Messages[0].Role != "user" {
		t.Fatalf("messages = %#v", got.Messages)
	}
	if !strings.Contains(got.Context, `"month":"2026-05"`) || !strings.Contains(got.Context, "3,500.00 SAR") {
		t.Fatalf("context = %s", got.Context)
	}
}

func TestCentralAnswerFailsCleanly(t *testing.T) {
	cases := map[string]struct {
		status int
		body   string
	}{
		"provider error": {status: http.StatusBadGateway, body: `{"error":"the model did not answer"}`},
		"empty reply":    {status: http.StatusOK, body: `{"reply":"   "}`},
		"bad json":       {status: http.StatusOK, body: `not json`},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(tc.status)
				io.WriteString(w, tc.body)
			}))
			defer srv.Close()
			c := &Central{baseURL: srv.URL, apiKey: "test-key", http: srv.Client()}
			if _, err := c.Answer(context.Background(), ChatSummary{}, []ChatMessage{{Role: "user", Content: "hi"}}); err == nil {
				t.Fatal("expected an error")
			}
		})
	}
}

func TestCentralFromEnv(t *testing.T) {
	t.Setenv("GROOSZY_CHAT_URL", "")
	t.Setenv("GROOSZY_CHAT_API_KEY", "")
	if CentralFromEnv() != nil {
		t.Fatal("expected nil when unset")
	}
	t.Setenv("GROOSZY_CHAT_URL", "https://chat-api.example.com/")
	t.Setenv("GROOSZY_CHAT_API_KEY", "key")
	c := CentralFromEnv()
	if !c.Enabled() {
		t.Fatal("expected enabled")
	}
	if c.baseURL != "https://chat-api.example.com" {
		t.Fatalf("baseURL = %q", c.baseURL)
	}
}
