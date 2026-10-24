import { describe, it, expect } from "vitest";
import { parseIdToken } from "@/lib/auth/oidc";
import { generateVerifier, generateS256Challenge, generateState, generateNonce } from "@/lib/auth/pkce";

const TEST_ISSUER = "https://auth.example.com";
const TEST_CLIENT_ID = "test-client-id";
const TEST_NONCE = "test-nonce";

function encodeJWT(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

function createValidToken(overrides?: Record<string, unknown>): string {
  return encodeJWT({
    sub: "user-123",
    nonce: TEST_NONCE,
    iss: TEST_ISSUER,
    aud: TEST_CLIENT_ID,
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  });
}

describe("auth functions", () => {
  describe("parseIdToken", () => {
    it("parses valid ID token with all claims", () => {
      const token = createValidToken();

      const claims = parseIdToken(token, TEST_NONCE, TEST_ISSUER, TEST_CLIENT_ID);

      expect(claims.sub).toBe("user-123");
      expect(claims.nonce).toBe(TEST_NONCE);
      expect(claims.iss).toBe(TEST_ISSUER);
      expect(claims.aud).toBe(TEST_CLIENT_ID);
    });

    it("rejects token with mismatched issuer", () => {
      const token = createValidToken({
        iss: "https://wrong-issuer.com",
      });

      expect(() => {
        parseIdToken(token, TEST_NONCE, TEST_ISSUER, TEST_CLIENT_ID);
      }).toThrow("Issuer mismatch");
    });

    it("rejects token with mismatched audience", () => {
      const token = createValidToken({
        aud: "wrong-client-id",
      });

      expect(() => {
        parseIdToken(token, TEST_NONCE, TEST_ISSUER, TEST_CLIENT_ID);
      }).toThrow("Audience mismatch");
    });

    it("accepts token with audience as array containing client ID", () => {
      const token = createValidToken({
        aud: ["other-client", TEST_CLIENT_ID, "another-client"],
      });

      const claims = parseIdToken(token, TEST_NONCE, TEST_ISSUER, TEST_CLIENT_ID);

      expect(claims.aud).toEqual(["other-client", TEST_CLIENT_ID, "another-client"]);
    });

    it("rejects token with audience array not containing client ID", () => {
      const token = createValidToken({
        aud: ["other-client", "another-client"],
      });

      expect(() => {
        parseIdToken(token, TEST_NONCE, TEST_ISSUER, TEST_CLIENT_ID);
      }).toThrow("Audience mismatch");
    });

    it("rejects expired token", () => {
      const token = createValidToken({
        exp: Math.floor(Date.now() / 1000) - 120,
      });

      expect(() => {
        parseIdToken(token, TEST_NONCE, TEST_ISSUER, TEST_CLIENT_ID);
      }).toThrow("Token expired");
    });

    it("allows token expiring within skew tolerance (60 seconds)", () => {
      const token = createValidToken({
        exp: Math.floor(Date.now() / 1000) - 30,
      });

      const claims = parseIdToken(token, TEST_NONCE, TEST_ISSUER, TEST_CLIENT_ID);

      expect(claims.sub).toBe("user-123");
    });

    it("rejects token with mismatched nonce", () => {
      const token = createValidToken({
        nonce: "wrong-nonce",
      });

      expect(() => {
        parseIdToken(token, TEST_NONCE, TEST_ISSUER, TEST_CLIENT_ID);
      }).toThrow("Nonce mismatch");
    });

    it("rejects malformed token", () => {
      expect(() => {
        parseIdToken("not.a.valid.token", TEST_NONCE, TEST_ISSUER, TEST_CLIENT_ID);
      }).toThrow();
    });
  });

  describe("PKCE functions", () => {
    it("generates unique verifiers", () => {
      const v1 = generateVerifier();
      const v2 = generateVerifier();

      expect(v1).not.toBe(v2);
      expect(v1.length).toBeGreaterThan(0);
      expect(v2.length).toBeGreaterThan(0);
    });

    it("generates S256 challenge from verifier", () => {
      const verifier = generateVerifier();
      const challenge = generateS256Challenge(verifier);

      expect(challenge).not.toBe(verifier);
      expect(challenge.length).toBeGreaterThan(0);
    });

    it("generates unique states", () => {
      const s1 = generateState();
      const s2 = generateState();

      expect(s1).not.toBe(s2);
      expect(s1.length).toBeGreaterThan(0);
    });

    it("generates unique nonces", () => {
      const n1 = generateNonce();
      const n2 = generateNonce();

      expect(n1).not.toBe(n2);
      expect(n1.length).toBeGreaterThan(0);
    });
  });
});
