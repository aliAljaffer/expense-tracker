import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as http from "node:http";
import { AddressInfo } from "node:net";
import { buildAuthorizationUrl, fetchDiscovery, exchangeCode, refreshToken } from "./oidc";

describe("oidc", () => {
  const issuer = "https://keycloak.example.com/realms/homelab/";

  describe("buildAuthorizationUrl", () => {
    it("builds authorization URL with all parameters", () => {
      const url = buildAuthorizationUrl({
        issuer,
        authorizationEndpoint: "https://keycloak.example.com/realms/homelab/protocol/openid-connect/auth",
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
        authorizationEndpoint: "https://keycloak.example.com/realms/homelab/protocol/openid-connect/auth",
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
        authorizationEndpoint: "https://keycloak.example.com/realms/homelab/protocol/openid-connect/auth",
        clientId: "test-client",
        redirectUri: "https://example.com/callback?param=value",
        codeChallenge: "test-challenge",
        state: "test-state",
        nonce: "test-nonce",
      });

      expect(url.toString()).toContain("redirect_uri=");
      expect(url.toString()).toContain("callback");
    });

    it("uses provided authorization endpoint", () => {
      const authEndpoint = "https://auth.local/custom/realm/authorize";
      const url = buildAuthorizationUrl({
        issuer: "https://auth.local/custom/realm/",
        authorizationEndpoint: authEndpoint,
        clientId: "client",
        redirectUri: "https://app.local/cb",
        codeChallenge: "challenge",
        state: "state",
        nonce: "nonce",
      });

      expect(url.toString()).toContain(authEndpoint);
    });

    it("does not include client_secret in authorization URL", () => {
      const url = buildAuthorizationUrl({
        issuer,
        authorizationEndpoint: "https://keycloak.example.com/realms/homelab/protocol/openid-connect/auth",
        clientId: "test-client",
        redirectUri: "https://example.com/callback",
        codeChallenge: "test-challenge",
        state: "test-state",
        nonce: "test-nonce",
      });

      expect(url.toString()).not.toContain("client_secret");
    });
  });

  describe("fetchDiscovery", () => {
    let server: http.Server;
    let serverUrl: string;

    beforeEach(
      () =>
        new Promise<void>((resolve) => {
          server = http.createServer((req, res) => {
            if (req.url === "/.well-known/openid-configuration") {
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(
                JSON.stringify({
                  authorization_endpoint: "https://auth.example.com/auth",
                  token_endpoint: "https://auth.example.com/token",
                  jwks_uri: "https://auth.example.com/jwks",
                  issuer: "https://auth.example.com",
                })
              );
            } else {
              res.writeHead(404);
              res.end();
            }
          });
          server.listen(0, () => {
            const addr = server.address() as AddressInfo;
            serverUrl = `http://localhost:${addr.port}/`;
            resolve();
          });
        })
    );

    afterEach(
      () =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        })
    );

    it("returns discovery endpoints on 200", async () => {
      const discovery = await fetchDiscovery(serverUrl);

      expect(discovery.authorization_endpoint).toBe("https://auth.example.com/auth");
      expect(discovery.token_endpoint).toBe("https://auth.example.com/token");
      expect(discovery.jwks_uri).toBe("https://auth.example.com/jwks");
      expect(discovery.issuer).toBe("https://auth.example.com");
    });

    it("rejects with error on non-200 response", async () => {
      const badServerUrl = "http://localhost:0/"; // invalid port
      await expect(fetchDiscovery(badServerUrl)).rejects.toThrow();
    });
  });

  describe("exchangeCode", () => {
    let server: http.Server;
    let serverUrl: string;

    beforeEach(
      () =>
        new Promise<void>((resolve) => {
          server = http.createServer((req, res) => {
            if (req.url === "/protocol/openid-connect/token" && req.method === "POST") {
              let body = "";
              req.on("data", (chunk) => {
                body += chunk;
              });
              req.on("end", () => {
                if (body.includes("grant_type=authorization_code") && body.includes("code_verifier=") && body.includes("redirect_uri=")) {
                  res.writeHead(200, { "Content-Type": "application/json" });
                  res.end(
                    JSON.stringify({
                      access_token: "new-access-token",
                      refresh_token: "new-refresh-token",
                      expires_in: 3600,
                      token_type: "Bearer",
                    })
                  );
                } else {
                  res.writeHead(400, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ error: "invalid_request" }));
                }
              });
            } else {
              res.writeHead(404);
              res.end();
            }
          });
          server.listen(0, () => {
            const addr = server.address() as AddressInfo;
            serverUrl = `http://localhost:${addr.port}/`;
            resolve();
          });
        })
    );

    afterEach(
      () =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        })
    );

    it("posts grant_type=authorization_code with code_verifier and redirect_uri", async () => {
      const tokens = await exchangeCode({
        tokenEndpoint: `${serverUrl}protocol/openid-connect/token`,
        clientId: "client",
        redirectUri: "https://app.example.com/callback",
        code: "auth-code",
        verifier: "code-verifier-value",
      });

      expect(tokens.access_token).toBe("new-access-token");
      expect(tokens.refresh_token).toBe("new-refresh-token");
      expect(tokens.expires_in).toBe(3600);
    });

    it("throws error without including code or token in message on 400", async () => {
      try {
        await exchangeCode({
          tokenEndpoint: `${serverUrl}protocol/openid-connect/token`,
          clientId: "client",
          redirectUri: "https://app.example.com/callback",
          code: "auth-code-secret",
          verifier: "code-verifier-secret",
        });
        expect.fail("Should have thrown");
      } catch (error) {
        const message = String(error);
        expect(message).not.toContain("auth-code-secret");
        expect(message).not.toContain("code-verifier-secret");
      }
    });
  });

  describe("refreshToken", () => {
    let server: http.Server;
    let serverUrl: string;

    beforeEach(
      () =>
        new Promise<void>((resolve) => {
          server = http.createServer((req, res) => {
            if (req.url === "/protocol/openid-connect/token" && req.method === "POST") {
              let body = "";
              req.on("data", (chunk) => {
                body += chunk;
              });
              req.on("end", () => {
                if (body.includes("grant_type=refresh_token")) {
                  res.writeHead(200, { "Content-Type": "application/json" });
                  res.end(
                    JSON.stringify({
                      access_token: "refreshed-access-token",
                      refresh_token: "refreshed-refresh-token",
                      expires_in: 3600,
                      token_type: "Bearer",
                    })
                  );
                } else {
                  res.writeHead(400, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ error: "invalid_request" }));
                }
              });
            } else {
              res.writeHead(404);
              res.end();
            }
          });
          server.listen(0, () => {
            const addr = server.address() as AddressInfo;
            serverUrl = `http://localhost:${addr.port}/`;
            resolve();
          });
        })
    );

    afterEach(
      () =>
        new Promise<void>((resolve) => {
          server.close(() => resolve());
        })
    );

    it("posts grant_type=refresh_token and returns new tokens", async () => {
      const tokens = await refreshToken({
        issuer: serverUrl,
        clientId: "client",
        refreshToken: "refresh-token-value",
      });

      expect(tokens.access_token).toBe("refreshed-access-token");
      expect(tokens.refresh_token).toBe("refreshed-refresh-token");
      expect(tokens.expires_in).toBe(3600);
    });
  });
});
