package explain

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
)

type openaiClient struct{}

type openaiMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openaiRequest struct {
	Model     string          `json:"model"`
	MaxTokens int64           `json:"max_tokens"`
	Messages  []openaiMessage `json:"messages"`
}

type openaiChoice struct {
	Message openaiMessage `json:"message"`
}

type openaiResponse struct {
	Choices []openaiChoice `json:"choices"`
}

func (openaiClient) Complete(ctx context.Context, hc *http.Client, cfg Config, system, user string) (string, error) {
	body, err := json.Marshal(openaiRequest{
		Model:     cfg.Model,
		MaxTokens: int64(cfg.MaxOutputTokens),
		Messages:  []openaiMessage{{Role: "system", Content: system}, {Role: "user", Content: user}},
	})
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		strings.TrimRight(cfg.BaseURL, "/")+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+cfg.APIKey)

	data, err := deliver(hc, req)
	if err != nil {
		return "", err
	}
	var out openaiResponse
	if err := json.Unmarshal(data, &out); err != nil {
		return "", errors.New("provider response unreadable")
	}
	for _, choice := range out.Choices {
		if strings.TrimSpace(choice.Message.Content) != "" {
			return choice.Message.Content, nil
		}
	}
	return "", errors.New("provider sent no text")
}
