package auth

import (
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"math/big"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestAuthenticate(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	var issuer string
	mux := http.NewServeMux()
	mux.HandleFunc("/.well-known/openid-configuration", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{
			"issuer":                                issuer,
			"authorization_endpoint":                issuer + "/auth",
			"token_endpoint":                        issuer + "/token",
			"jwks_uri":                              issuer + "/keys",
			"response_types_supported":              []string{"code"},
			"subject_types_supported":               []string{"public"},
			"id_token_signing_alg_values_supported": []string{"RS256"},
		})
	})
	mux.HandleFunc("/keys", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]any{"keys": []map[string]any{{
			"kty": "RSA", "kid": "test", "use": "sig", "alg": "RS256",
			"n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()),
			"e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes()),
		}}})
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()
	issuer = srv.URL

	v, err := New(t.Context(), issuer, "expense-tracker", "owner-sub")
	if err != nil {
		t.Fatal(err)
	}

	token := func(claims map[string]any) string {
		header, _ := json.Marshal(map[string]string{"alg": "RS256", "typ": "JWT", "kid": "test"})
		body, _ := json.Marshal(claims)
		unsigned := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(body)
		sum := sha256.Sum256([]byte(unsigned))
		sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, sum[:])
		if err != nil {
			t.Fatal(err)
		}
		return unsigned + "." + base64.RawURLEncoding.EncodeToString(sig)
	}
	now := time.Now()
	valid := map[string]any{
		"iss": issuer, "aud": "expense-tracker", "sub": "owner-sub",
		"exp": now.Add(time.Minute).Unix(), "iat": now.Unix(),
		"email": "owner@example.test", "name": "Owner",
	}

	cases := []struct {
		name    string
		header  string
		wantErr error
	}{
		{"valid owner", "Bearer " + token(valid), nil},
		{"missing header", "", ErrUnauthenticated},
		{"not bearer", "Basic abc", ErrUnauthenticated},
		{"garbage token", "Bearer abc.def.ghi", ErrUnauthenticated},
		{"expired", "Bearer " + token(map[string]any{
			"iss": issuer, "aud": "expense-tracker", "sub": "owner-sub",
			"exp": now.Add(-time.Minute).Unix(), "iat": now.Add(-2 * time.Minute).Unix(),
		}), ErrUnauthenticated},
		{"wrong audience", "Bearer " + token(map[string]any{
			"iss": issuer, "aud": "another-client", "sub": "owner-sub",
			"exp": now.Add(time.Minute).Unix(), "iat": now.Unix(),
		}), ErrUnauthenticated},
		{"wrong issuer", "Bearer " + token(map[string]any{
			"iss": "https://elsewhere.test", "aud": "expense-tracker", "sub": "owner-sub",
			"exp": now.Add(time.Minute).Unix(), "iat": now.Unix(),
		}), ErrUnauthenticated},
		{"other subject", "Bearer " + token(map[string]any{
			"iss": issuer, "aud": "expense-tracker", "sub": "someone-else",
			"exp": now.Add(time.Minute).Unix(), "iat": now.Unix(),
		}), ErrForbidden},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			r := httptest.NewRequest("GET", "/api/me", nil)
			if tc.header != "" {
				r.Header.Set("Authorization", tc.header)
			}
			id, err := v.Authenticate(r)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("err = %v, want %v", err, tc.wantErr)
			}
			if tc.wantErr == nil {
				if id.Subject != "owner-sub" || id.Name != "Owner" {
					t.Fatalf("identity = %+v", id)
				}
			}
		})
	}
}
