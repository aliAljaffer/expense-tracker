import { describe, it, expect } from "vitest";
import { parseIdToken } from "@/lib/auth/oidc";
import { generateVerifier, generateS256Challenge, generateState, generateNonce } from "@/lib/auth/pkce";

function encodeJWT(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.signature`;
}

describe("auth functions", () => {
  describe("parseIdToken", () => {
    it("parses ID token and validates nonce", () => {
      const nonce = "test-nonce";
      const token = encodeJWT({
        sub: "user-123",
        nonce,
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      const claims = parseIdToken(token, nonce);

      expect(claims.sub).toBe("user-123");
      expect(claims.nonce).toBe(nonce);
    });

    it("rejects token with mismatched nonce", () => {
      const token = encodeJWT({
        sub: "user-123",
        nonce: "wrong-nonce",
        exp: Math.floor(Date.now() / 1000) + 3600,
      });

      expect(() => {
        parseIdToken(token, "expected-nonce");
      }).toThrow("Nonce mismatch");
    });

    it("rejects malformed token", () => {
      expect(() => {
        parseIdToken("not.a.valid.token", "nonce");
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
