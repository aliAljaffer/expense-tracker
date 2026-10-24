// Package config reads the API settings from the environment. Nothing has a
// default that would make authentication optional.
package config

import (
	"fmt"
	"os"
	"sort"
	"strconv"
	"strings"
)

type Config struct {
	ListenAddr     string
	DatabaseURL    string
	OIDCIssuer     string
	OIDCAudience   string
	OwnerSubject   string
	MaxUploadBytes int64
}

func Load() (Config, error) {
	c := Config{
		ListenAddr:     envOr("LISTEN_ADDR", ":8080"),
		DatabaseURL:    os.Getenv("DATABASE_URL"),
		OIDCIssuer:     os.Getenv("OIDC_ISSUER"),
		OIDCAudience:   envOr("OIDC_AUDIENCE", "grooszy"),
		OwnerSubject:   os.Getenv("OIDC_OWNER_SUBJECT"),
		MaxUploadBytes: 16 << 20,
	}
	if v := os.Getenv("MAX_UPLOAD_BYTES"); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil || n <= 0 {
			return Config{}, fmt.Errorf("MAX_UPLOAD_BYTES must be a positive number")
		}
		c.MaxUploadBytes = n
	}
	var missing []string
	for name, value := range map[string]string{
		"DATABASE_URL":       c.DatabaseURL,
		"OIDC_ISSUER":        c.OIDCIssuer,
		"OIDC_OWNER_SUBJECT": c.OwnerSubject,
	} {
		if strings.TrimSpace(value) == "" {
			missing = append(missing, name)
		}
	}
	sort.Strings(missing)
	if len(missing) > 0 {
		return Config{}, fmt.Errorf("missing required environment: %s", strings.Join(missing, ", "))
	}
	return c, nil
}

func envOr(name, fallback string) string {
	if v := os.Getenv(name); v != "" {
		return v
	}
	return fallback
}
