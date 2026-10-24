import { describe, it, expect } from "vitest";
import {
  generateVerifier,
  generateS256Challenge,
  generateState,
  generateNonce,
} from "./pkce";

describe("pkce", () => {
  describe("generateVerifier", () => {
    it("generates a string", () => {
      const verifier = generateVerifier();
      expect(typeof verifier).toBe("string");
    });

    it("generates different values on each call", () => {
      const v1 = generateVerifier();
      const v2 = generateVerifier();
      expect(v1).not.toBe(v2);
    });

    it("uses base64url encoding", () => {
      const verifier = generateVerifier();
      expect(/^[A-Za-z0-9_-]+$/.test(verifier)).toBe(true);
      expect(verifier).not.toContain("+");
      expect(verifier).not.toContain("/");
      expect(verifier).not.toContain("=");
    });
  });

  describe("generateS256Challenge", () => {
    it("is deterministic for same verifier", () => {
      const verifier = generateVerifier();
      const challenge1 = generateS256Challenge(verifier);
      const challenge2 = generateS256Challenge(verifier);
      expect(challenge1).toBe(challenge2);
    });

    it("generates different challenges for different verifiers", () => {
      const v1 = generateVerifier();
      const v2 = generateVerifier();
      const c1 = generateS256Challenge(v1);
      const c2 = generateS256Challenge(v2);
      expect(c1).not.toBe(c2);
    });

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
    it("generates a string", () => {
      const state = generateState();
      expect(typeof state).toBe("string");
    });

    it("generates different values on each call", () => {
      const s1 = generateState();
      const s2 = generateState();
      expect(s1).not.toBe(s2);
    });

    it("uses base64url encoding", () => {
      const state = generateState();
      expect(/^[A-Za-z0-9_-]+$/.test(state)).toBe(true);
      expect(state).not.toContain("+");
      expect(state).not.toContain("/");
      expect(state).not.toContain("=");
    });
  });

  describe("generateNonce", () => {
    it("generates a string", () => {
      const nonce = generateNonce();
      expect(typeof nonce).toBe("string");
    });

    it("generates different values on each call", () => {
      const n1 = generateNonce();
      const n2 = generateNonce();
      expect(n1).not.toBe(n2);
    });

    it("uses base64url encoding", () => {
      const nonce = generateNonce();
      expect(/^[A-Za-z0-9_-]+$/.test(nonce)).toBe(true);
      expect(nonce).not.toContain("+");
      expect(nonce).not.toContain("/");
      expect(nonce).not.toContain("=");
    });
  });
});
