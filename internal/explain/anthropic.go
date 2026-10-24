package explain

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

type anthropicClient struct{}

type anthropicMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type anthropicRequest struct {
	Model     string             `json:"model"`
	MaxTokens int64              `json:"max_tokens"`
	System    string             `json:"system"`
	Messages  []anthropicMessage `json:"messages"`
}

type anthropicBlock struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type anthropicResponse struct {
	Content []anthropicBlock `json:"content"`
}

func (anthropicClient) Complete(ctx context.Context, hc *http.Client, cfg Config, system, user string) (string, error) {
	body, err := json.Marshal(anthropicRequest{
		Model:     cfg.Model,
		MaxTokens: int64(cfg.MaxOutputTokens),
		System:    system,
		Messages:  []anthropicMessage{{Role: "user", Content: user}},
	})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		strings.TrimRight(cfg.BaseURL, "/")+"/v1/messages", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", cfg.APIKey)
	req.Header.Set("anthropic-version", "2023-06-01")

	data, err := deliver(hc, req)
	if err != nil {
		return "", err
	}
	var out anthropicResponse
	if err := json.Unmarshal(data, &out); err != nil {
		return "", errors.New("provider response unreadable")
	}
	for _, block := range out.Content {
		if block.Type == "text" && strings.TrimSpace(block.Text) != "" {
			return block.Text, nil
		}
	}
	return "", errors.New("provider sent no text")
}
