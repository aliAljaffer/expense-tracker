import { describe, it, expect } from "vitest";
import { buildAuthorizationUrl } from "./oidc";

describe("oidc", () => {
  const issuer = "https://keycloak.example.com/realms/homelab/";

  describe("buildAuthorizationUrl", () => {
    it("builds authorization URL with all parameters", () => {
      const url = buildAuthorizationUrl({
        issuer,
        clientId: "test-client",
        redirectUri: "https://example.com/callback",
        codeChallenge: "test-challenge",
        state: "test-state",
        nonce: "test-nonce",
      });

      expect(url.toString()).toContain("client_id=test-client");
      expect(url.toString()).toContain("response_type=code");
      expect(url.toString()).toContain("code_challenge=test-challenge");
      expect(url.toString()).toContain("code_challenge_method=S256");
      expect(url.toString()).toContain("state=test-state");
      expect(url.toString()).toContain("nonce=test-nonce");
      expect(url.toString()).toContain("scope=openid+profile");
    });

    it("includes custom scopes", () => {
      const url = buildAuthorizationUrl({
        issuer,
        clientId: "test-client",
        redirectUri: "https://example.com/callback",
        codeChallenge: "test-challenge",
        state: "test-state",
        nonce: "test-nonce",
        scopes: ["openid", "profile", "email"],
      });

      expect(url.toString()).toContain("scope=openid+profile+email");
    });

    it("encodes redirect URI properly", () => {
      const url = buildAuthorizationUrl({
        issuer,
        clientId: "test-client",
        redirectUri: "https://example.com/callback?param=value",
        codeChallenge: "test-challenge",
        state: "test-state",
        nonce: "test-nonce",
      });

      expect(url.toString()).toContain("redirect_uri=");
      expect(url.toString()).toContain("callback");
    });

    it("preserves issuer path structure", () => {
      const url = buildAuthorizationUrl({
        issuer: "https://auth.local/custom/realm/",
        clientId: "client",
        redirectUri: "https://app.local/cb",
        codeChallenge: "challenge",
        state: "state",
        nonce: "nonce",
      });

      expect(url.toString()).toContain("https://auth.local/custom/realm/protocol/openid-connect/auth");
    });
  });
});
