import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { probeHealth, probeReadiness } from "./probe";

// Mock fetch
global.fetch = vi.fn();

describe("probe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.API_BASE_URL = "http://localhost:8080";
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete process.env.API_BASE_URL;
  });

  describe("probeHealth", () => {
    it("returns ready when /healthz returns 200 with status ok", async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: "ok" }),
      });

      const result = await probeHealth();

      expect(result.status).toBe("ready");
      expect(result.reason).toBeUndefined();
    });

    it("returns unavailable when fetch rejects", async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await probeHealth();

      expect(result.status).toBe("unavailable");
      expect(result.reason).toBe("The API did not answer");
    });

    it("returns unavailable when request times out", async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await probeHealth();

      expect(result.status).toBe("unavailable");
      expect(result.reason).toContain("timeout");
    });

    it("returns unavailable when response status is not 200", async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce({
        status: 500,
        json: async () => ({}),
      });

      const result = await probeHealth();

      expect(result.status).toBe("unavailable");
    });

    it("returns unavailable when response JSON is malformed", async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => {
          throw new Error("JSON parse error");
        },
      });

      const result = await probeHealth();

      expect(result.status).toBe("unavailable");
      expect(result.reason).toContain("not valid JSON");
    });
  });

  describe("probeReadiness", () => {
    it("returns ready when /readyz returns 200 with status ready", async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce({
        status: 200,
        json: async () => ({ status: "ready" }),
      });

      const result = await probeReadiness();

      expect(result.status).toBe("ready");
      expect(result.reason).toBeUndefined();
    });

    it("returns unavailable when /readyz returns 503 (database unavailable)", async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      mockFetch.mockResolvedValueOnce({
        status: 503,
        json: async () => ({ error: "database unavailable" }),
      });

      const result = await probeReadiness();

      expect(result.status).toBe("unavailable");
      expect(result.reason).toBe("The database is not reachable");
    });

    it("returns unavailable when fetch rejects", async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await probeReadiness();

      expect(result.status).toBe("unavailable");
      expect(result.reason).toBe("The API did not answer");
    });

    it("returns unavailable when request times out", async () => {
      const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(abortError);

      const result = await probeReadiness();

      expect(result.status).toBe("unavailable");
      expect(result.reason).toContain("timeout");
    });
  });

  it("does not leak API_BASE_URL value into response reason", async () => {
    const mockFetch = global.fetch as ReturnType<typeof vi.fn>;
    mockFetch.mockResolvedValueOnce({
      status: 200,
      json: async () => ({ status: "ok" }),
    });

    const result = await probeHealth();

    if (result.reason) {
      expect(result.reason).not.toContain("localhost");
      expect(result.reason).not.toContain("8080");
    }
  });
});
