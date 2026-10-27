import { describe, it, expect } from "vitest";
import {
  generateVerifier,
  generateS256Challenge,
  generateState,
  generateNonce,
} from "./pkce";

describe("pkce", () => {
  describe("generateVerifier", () => {
    it("uses base64url encoding", () => {
      const verifier = generateVerifier();
      expect(/^[A-Za-z0-9_-]+$/.test(verifier)).toBe(true);
      expect(verifier).not.toContain("+");
      expect(verifier).not.toContain("/");
      expect(verifier).not.toContain("=");
    });
  });

  describe("generateS256Challenge", () => {
    it("uses base64url encoding", () => {
      const verifier = generateVerifier();
      const challenge = generateS256Challenge(verifier);
      expect(/^[A-Za-z0-9_-]+$/.test(challenge)).toBe(true);
      expect(challenge).not.toContain("+");
      expect(challenge).not.toContain("/");
      expect(challenge).not.toContain("=");
    });
  });

  describe("generateState", () => {
    it("uses base64url encoding", () => {
      const state = generateState();
      expect(/^[A-Za-z0-9_-]+$/.test(state)).toBe(true);
      expect(state).not.toContain("+");
      expect(state).not.toContain("/");
      expect(state).not.toContain("=");
    });
  });

  describe("generateNonce", () => {
    it("uses base64url encoding", () => {
      const nonce = generateNonce();
      expect(/^[A-Za-z0-9_-]+$/.test(nonce)).toBe(true);
      expect(nonce).not.toContain("+");
      expect(nonce).not.toContain("/");
      expect(nonce).not.toContain("=");
    });
  });

  describe("RFC 7636 Appendix B test vector", () => {
    it("generates correct S256 challenge for appendix B verifier", () => {
      const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
      const challenge = generateS256Challenge(verifier);

      expect(challenge).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    });
  });
});
