// Package auth validates Keycloak access tokens and restricts the API to the
// one configured owner. Identity comes from the signed token only: headers set
// by a browser or an ingress are never trusted.
package auth

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
)

var (
	ErrUnauthenticated = errors.New("missing or invalid access token")
	ErrForbidden       = errors.New("token subject is not the configured owner")
)

type Identity struct {
	Subject string
	Email   string
	Name    string
}

type Verifier struct {
	tokens *oidc.IDTokenVerifier
	owner  string
}

// New discovers the issuer's signing keys and builds a verifier. A token must
// carry the audience and be signed by that issuer before its subject is read.
func New(ctx context.Context, issuer, audience, owner string) (*Verifier, error) {
	if issuer == "" || audience == "" || owner == "" {
		return nil, fmt.Errorf("issuer, audience and owner subject are required")
	}
	provider, err := oidc.NewProvider(ctx, issuer)
	if err != nil {
		return nil, fmt.Errorf("discover issuer: %w", err)
	}
	return &Verifier{
		tokens: provider.Verifier(&oidc.Config{ClientID: audience}),
		owner:  owner,
	}, nil
}

// Authenticate returns the caller identity or a wrapped ErrUnauthenticated or
// ErrForbidden.
func (v *Verifier) Authenticate(r *http.Request) (Identity, error) {
	raw, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok || raw == "" {
		return Identity{}, ErrUnauthenticated
	}
	token, err := v.tokens.Verify(r.Context(), raw)
	if err != nil {
		return Identity{}, fmt.Errorf("%w: %v", ErrUnauthenticated, err)
	}
	if token.Subject != v.owner {
		return Identity{}, ErrForbidden
	}
	var claims struct {
		Email             string `json:"email"`
		Name              string `json:"name"`
		PreferredUsername string `json:"preferred_username"`
	}
	if err := token.Claims(&claims); err != nil {
		return Identity{}, fmt.Errorf("%w: claims: %v", ErrUnauthenticated, err)
	}
	name := claims.Name
	if name == "" {
		name = claims.PreferredUsername
	}
	return Identity{Subject: token.Subject, Email: claims.Email, Name: name}, nil
}
