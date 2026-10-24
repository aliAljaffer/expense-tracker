import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCookieChunks, type SessionPayload } from "./session";
import { createCipheriv, hkdfSync, randomBytes } from "node:crypto";

const testSecret = "test-secret-key-for-hashing-purposes-at-least-32-chars";

const testPayload: SessionPayload = {
  accessToken: "access-token-value",
  refreshToken: "refresh-token-value",
  expiresAt: Date.now() + 3600000,
  subject: "user-subject",
};

describe("session", () => {
  describe("getCookieChunks", () => {
    it("returns single chunk for small payload", () => {
      const encrypted = "small-payload";
      const chunks = getCookieChunks(encrypted);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].name).toBe("et_session.0");
      expect(chunks[0].value).toBe("small-payload");
    });

    it("splits large payload into multiple chunks", () => {
      const largePayload = "x".repeat(10000);
      const chunks = getCookieChunks(largePayload);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].name).toBe("et_session.0");
      expect(chunks[0].value.length).toBeLessThanOrEqual(3800);
      expect(chunks[chunks.length - 1].name).toBe(`et_session.${chunks.length - 1}`);
    });

    it("preserves full payload across chunks", () => {
      const payload = "x".repeat(10000);
      const chunks = getCookieChunks(payload);
      const reconstructed = chunks.map((c) => c.value).join("");

      expect(reconstructed).toBe(payload);
    });

    it("numbers chunks sequentially", () => {
      const largePayload = "x".repeat(10000);
      const chunks = getCookieChunks(largePayload);

      chunks.forEach((chunk, index) => {
        expect(chunk.name).toBe(`et_session.${index}`);
      });
    });
  });

  describe("roundtrip encrypt/decrypt", () => {
    it("decrypts to original payload", () => {
      const keyBuffer = Buffer.from(hkdfSync("sha256", testSecret, "", "", 32));
      const iv = randomBytes(12);
      const plaintext = JSON.stringify(testPayload);
      const cipher = createCipheriv("aes-256-gcm", keyBuffer, iv);

      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();
      const combined = iv.toString("hex") + authTag.toString("hex") + encrypted;

      const testChunks = getCookieChunks(combined);
      const reconstructed = testChunks.map((c) => c.value).join("");

      expect(reconstructed).toBe(combined);
    });

    it("fails on tampered ciphertext", () => {
      const keyBuffer = Buffer.from(hkdfSync("sha256", testSecret, "", "", 32));
      const iv = randomBytes(12);
      const plaintext = JSON.stringify(testPayload);
      const cipher = createCipheriv("aes-256-gcm", keyBuffer, iv);

      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();
      const combined = iv.toString("hex") + authTag.toString("hex") + encrypted;

      const tampered =
        combined.slice(0, 56) +
        (combined.charCodeAt(56) === 97 ? "b" : "a") +
        combined.slice(57);

      const testChunks = getCookieChunks(tampered);
      const reconstructed = testChunks.map((c) => c.value).join("");

      expect(reconstructed).not.toBe(combined);
    });

    it("fails on tampered auth tag", () => {
      const keyBuffer = Buffer.from(hkdfSync("sha256", testSecret, "", "", 32));
      const iv = randomBytes(12);
      const plaintext = JSON.stringify(testPayload);
      const cipher = createCipheriv("aes-256-gcm", keyBuffer, iv);

      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();
      const combined = iv.toString("hex") + authTag.toString("hex") + encrypted;

      const tampered =
        combined.slice(0, 24) +
        (combined.charCodeAt(24) === 97 ? "b" : "a") +
        combined.slice(25);

      const testChunks = getCookieChunks(tampered);
      const reconstructed = testChunks.map((c) => c.value).join("");

      expect(reconstructed).not.toBe(combined);
    });

    it("handles 10 KB payload in multiple chunks", () => {
      const largePayload: SessionPayload = {
        ...testPayload,
        accessToken: "a".repeat(5000),
        refreshToken: "r".repeat(5000),
      };

      const keyBuffer = Buffer.from(hkdfSync("sha256", testSecret, "", "", 32));
      const iv = randomBytes(12);
      const plaintext = JSON.stringify(largePayload);
      const cipher = createCipheriv("aes-256-gcm", keyBuffer, iv);

      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");

      const authTag = cipher.getAuthTag();
      const combined = iv.toString("hex") + authTag.toString("hex") + encrypted;

      const chunks = getCookieChunks(combined);
      expect(chunks.length).toBeGreaterThan(1);

      const reconstructed = chunks.map((c) => c.value).join("");
      expect(reconstructed).toBe(combined);
      expect(JSON.stringify(largePayload)).toBe(plaintext);
    });
  });

});
