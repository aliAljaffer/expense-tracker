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
	"strconv"
	"strings"
	"time"
)

const centralDefaultTimeout = 60 * time.Second

// Central answers chat turns through the shared chat service. The service
// receives the aggregate packet as context and never the statement rows.
type Central struct {
	baseURL string
	apiKey  string
	http    *http.Client
}

type centralRequest struct {
	Messages []ChatMessage `json:"messages"`
	Context  string        `json:"context,omitempty"`
}

type centralResponse struct {
	Reply string `json:"reply"`
}

func CentralFromEnv() *Central {
	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("GROOSZY_CHAT_URL")), "/")
	apiKey := strings.TrimSpace(os.Getenv("GROOSZY_CHAT_API_KEY"))
	if baseURL == "" || apiKey == "" {
		return nil
	}
	timeout := centralDefaultTimeout
	if v := os.Getenv("GROOSZY_CHAT_TIMEOUT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			timeout = time.Duration(n) * time.Second
		}
	}
	return &Central{baseURL: baseURL, apiKey: apiKey, http: &http.Client{Timeout: timeout}}
}

func (c *Central) Enabled() bool {
	return c != nil && c.baseURL != "" && c.apiKey != ""
}

func (c *Central) Answer(ctx context.Context, summary ChatSummary, conversation []ChatMessage) (string, error) {
	if !c.Enabled() {
		return "", ErrDisabled
	}
	packet, err := summary.packet()
	if err != nil {
		return "", err
	}
	body, err := json.Marshal(centralRequest{Messages: conversation, Context: packet})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/v1/chat", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		io.Copy(io.Discard, io.LimitReader(resp.Body, 4<<10))
		return "", fmt.Errorf("central chat returned status %d", resp.StatusCode)
	}
	var out centralResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(&out); err != nil {
		return "", errors.New("central chat response is unreadable")
	}
	if strings.TrimSpace(out.Reply) == "" {
		return "", errors.New("central chat returned no text")
	}
	return strings.TrimSpace(out.Reply), nil
}
