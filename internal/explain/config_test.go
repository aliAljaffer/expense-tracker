package explain

import (
	"testing"
	"time"
)

func clearExplainEnv(t *testing.T) {
	t.Helper()
	for _, name := range []string{
		"EXPENSE_EXPLAIN_PROVIDER",
		"EXPENSE_EXPLAIN_BASE_URL",
		"EXPENSE_EXPLAIN_MODEL",
		"EXPENSE_EXPLAIN_API_KEY",
		"EXPENSE_EXPLAIN_TIMEOUT",
	} {
		t.Setenv(name, "")
	}
}

func TestConfigFromEnvEmptyEnvironmentIsDisabled(t *testing.T) {
	clearExplainEnv(t)
	cfg := ConfigFromEnv()
	if cfg.Enabled {
		t.Fatal("empty environment must not enable the explainer")
	}
	if cfg.Timeout != DefaultTimeout || cfg.MaxOutputTokens != DefaultMaxOutputTokens {
		t.Fatalf("defaults = %v, %d", cfg.Timeout, cfg.MaxOutputTokens)
	}
}

func TestConfigFromEnvEnablesWithAllThree(t *testing.T) {
	clearExplainEnv(t)
	t.Setenv("EXPENSE_EXPLAIN_BASE_URL", "https://local.test/v1")
	t.Setenv("EXPENSE_EXPLAIN_MODEL", "local-model")
	t.Setenv("EXPENSE_EXPLAIN_API_KEY", "local-key")
	t.Setenv("EXPENSE_EXPLAIN_PROVIDER", "anthropic")
	t.Setenv("EXPENSE_EXPLAIN_TIMEOUT", "45")

	cfg := ConfigFromEnv()
	if !cfg.Enabled {
		t.Fatal("all three set but disabled")
	}
	if cfg.Provider != "anthropic" {
		t.Fatalf("provider = %q", cfg.Provider)
	}
	if cfg.Timeout != 45*time.Second {
		t.Fatalf("timeout = %v", cfg.Timeout)
	}
}

func TestConfigFromEnvDefaultsProviderToOpenAI(t *testing.T) {
	clearExplainEnv(t)
	t.Setenv("EXPENSE_EXPLAIN_BASE_URL", "https://local.test/v1")
	t.Setenv("EXPENSE_EXPLAIN_MODEL", "local-model")
	t.Setenv("EXPENSE_EXPLAIN_API_KEY", "local-key")

	if got := ConfigFromEnv().Provider; got != ProviderOpenAI {
		t.Fatalf("provider = %q, want openai", got)
	}
}

func TestConfigFromEnvPartialSettingIsDisabled(t *testing.T) {
	clearExplainEnv(t)
	t.Setenv("EXPENSE_EXPLAIN_BASE_URL", "https://local.test/v1")
	t.Setenv("EXPENSE_EXPLAIN_MODEL", "local-model")

	if cfg := ConfigFromEnv(); cfg.Enabled {
		t.Fatal("missing key must keep the explainer disabled")
	}
}

func TestNewRejectsUnknownProvider(t *testing.T) {
	cfg := Config{Provider: "misc", BaseURL: "https://local.test", Model: "m", APIKey: "k", Enabled: true}
	if New(cfg) != nil {
		t.Fatal("unknown provider must yield no explainer")
	}
}
