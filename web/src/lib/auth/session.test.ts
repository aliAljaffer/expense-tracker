import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getCookieChunks,
  readSession,
  refreshIfExpiring,
  writeSession,
  type SessionPayload,
} from "./session";
import { createCipheriv, hkdfSync, randomBytes } from "node:crypto";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

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
      expect(chunks[0].name).toBe("grooszy_session.0");
      expect(chunks[0].value).toBe("small-payload");
    });

    it("splits large payload into multiple chunks", () => {
      const largePayload = "x".repeat(10000);
      const chunks = getCookieChunks(largePayload);

      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks[0].name).toBe("grooszy_session.0");
      expect(chunks[0].value.length).toBeLessThanOrEqual(3800);
      expect(chunks[chunks.length - 1].name).toBe(`grooszy_session.${chunks.length - 1}`);
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
        expect(chunk.name).toBe(`grooszy_session.${index}`);
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

  describe("refreshIfExpiring", () => {
    let mockCookiesStore: Map<string, string>

    beforeEach(() => {
      vi.clearAllMocks();
      mockCookiesStore = new Map();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("does nothing when over 60 seconds remain", async () => {
      const futureExpiresAt = Date.now() + 90 * 1000;
      const session: SessionPayload = {
        ...testPayload,
        expiresAt: futureExpiresAt,
      };

      const keyBuffer = Buffer.from(hkdfSync("sha256", testSecret, "", "", 32));
      const iv = randomBytes(12);
      const plaintext = JSON.stringify(session);
      const cipher = createCipheriv("aes-256-gcm", keyBuffer, iv);
      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();
      const combined = iv.toString("hex") + authTag.toString("hex") + encrypted;
      const chunks = getCookieChunks(combined);

      chunks.forEach((chunk) => {
        mockCookiesStore.set(chunk.name, chunk.value);
      });

      const { cookies } = await import("next/headers");
      const mockStore = {
        get: (name: string) => (mockCookiesStore.has(name) ? { value: mockCookiesStore.get(name) || "" } : undefined),
      };
      vi.mocked(cookies).mockResolvedValue(mockStore as unknown as Awaited<ReturnType<typeof cookies>>);

      const refreshFn = vi.fn();
      const result = await refreshIfExpiring(testSecret, refreshFn);

      expect(result?.expiresAt).toBe(futureExpiresAt);
      expect(refreshFn).not.toHaveBeenCalled();
    });

    it("refreshes when under 60 seconds remain", async () => {
      const soonExpiresAt = Date.now() + 30 * 1000;
      const session: SessionPayload = {
        ...testPayload,
        expiresAt: soonExpiresAt,
      };

      const keyBuffer = Buffer.from(hkdfSync("sha256", testSecret, "", "", 32));
      const iv = randomBytes(12);
      const plaintext = JSON.stringify(session);
      const cipher = createCipheriv("aes-256-gcm", keyBuffer, iv);
      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();
      const combined = iv.toString("hex") + authTag.toString("hex") + encrypted;
      const chunks = getCookieChunks(combined);

      chunks.forEach((chunk) => {
        mockCookiesStore.set(chunk.name, chunk.value);
      });

      const { cookies } = await import("next/headers");
      const mockStore = {
        get: (name: string) => (mockCookiesStore.has(name) ? { value: mockCookiesStore.get(name) || "" } : undefined),
        set: (name: string, value: string) => {
          mockCookiesStore.set(name, value);
        },
      };
      vi.mocked(cookies).mockResolvedValue(mockStore as unknown as Awaited<ReturnType<typeof cookies>>);

      const newExpiresAt = Date.now() + 3600 * 1000;
      const refreshFn = vi.fn().mockResolvedValue({
        accessToken: "new-access-token",
        expiresAt: newExpiresAt,
      });

      const result = await refreshIfExpiring(testSecret, refreshFn);

      expect(refreshFn).toHaveBeenCalledWith(session.refreshToken);
      expect(result?.accessToken).toBe("new-access-token");
      expect(result?.refreshToken).toBe(session.refreshToken);
    });

    it("returns null when refresh fails", async () => {
      const soonExpiresAt = Date.now() + 30 * 1000;
      const session: SessionPayload = {
        ...testPayload,
        expiresAt: soonExpiresAt,
      };

      const keyBuffer = Buffer.from(hkdfSync("sha256", testSecret, "", "", 32));
      const iv = randomBytes(12);
      const plaintext = JSON.stringify(session);
      const cipher = createCipheriv("aes-256-gcm", keyBuffer, iv);
      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();
      const combined = iv.toString("hex") + authTag.toString("hex") + encrypted;
      const chunks = getCookieChunks(combined);

      chunks.forEach((chunk) => {
        mockCookiesStore.set(chunk.name, chunk.value);
      });

      const { cookies } = await import("next/headers");
      const mockStore = {
        get: (name: string) => (mockCookiesStore.has(name) ? { value: mockCookiesStore.get(name) || "" } : undefined),
      };
      vi.mocked(cookies).mockResolvedValue(mockStore as unknown as Awaited<ReturnType<typeof cookies>>);

      const refreshFn = vi.fn().mockRejectedValue(new Error("Refresh failed"));

      const result = await refreshIfExpiring(testSecret, refreshFn);

      expect(result).toBeNull();
    });

    it("returns null when no session exists", async () => {
      const { cookies } = await import("next/headers");
      const mockStore = {
        get: () => undefined,
      };
      vi.mocked(cookies).mockResolvedValue(mockStore as unknown as Awaited<ReturnType<typeof cookies>>);

      const refreshFn = vi.fn();
      const result = await refreshIfExpiring(testSecret, refreshFn);

      expect(result).toBeNull();
      expect(refreshFn).not.toHaveBeenCalled();
    });

    it("persists a rotated refresh token", async () => {
      const store = new Map<string, string>();
      const { cookies } = await import("next/headers");
      vi.mocked(cookies).mockResolvedValue({
        get: (name: string) => (store.has(name) ? { value: store.get(name) } : undefined),
        set: (name: string, value: string) => {
          store.set(name, value);
        },
        delete: (name: string) => {
          store.delete(name);
        },
      } as unknown as Awaited<ReturnType<typeof cookies>>);

      await writeSession({ ...testPayload, expiresAt: Date.now() + 30_000 }, testSecret);

      const result = await refreshIfExpiring(testSecret, async () => ({
        accessToken: "new-access-token",
        expiresAt: Date.now() + 3600 * 1000,
        refreshToken: "rotated-refresh-token",
      }));

      expect(result?.refreshToken).toBe("rotated-refresh-token");
      expect((await readSession(testSecret))?.refreshToken).toBe("rotated-refresh-token");
    });

    it("deletes chunks left over from a larger payload", async () => {
      const store = new Map<string, string>([["grooszy_session.1", "stale-chunk"]]);
      const deleted: string[] = [];
      const { cookies } = await import("next/headers");
      vi.mocked(cookies).mockResolvedValue({
        get: (name: string) => (store.has(name) ? { value: store.get(name) } : undefined),
        set: (name: string, value: string) => {
          store.set(name, value);
        },
        delete: (name: string) => {
          deleted.push(name);
          store.delete(name);
        },
      } as unknown as Awaited<ReturnType<typeof cookies>>);

      await writeSession(testPayload, testSecret);

      expect(deleted).toEqual(["grooszy_session.1"]);
      expect(store.has("grooszy_session.1")).toBe(false);
      expect((await readSession(testSecret))?.accessToken).toBe(testPayload.accessToken);
    });
  });

});
