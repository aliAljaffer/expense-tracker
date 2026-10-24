import { describe, it, expect, vi } from "vitest";
import type { NextRequest } from "next/server";

interface RouteParams {
  params: Promise<{ path: string[] }>;
}

describe("BFF route handler", () => {
  it("prevents direct proxy of /api/imports", async () => {
    const { GET } = await import("./[...path]/route");

    vi.stubEnv("OIDC_ISSUER", "https://example.com/realms/test");
    vi.stubEnv("OIDC_CLIENT_ID", "test-client");
    vi.stubEnv("SESSION_SECRET", "test-secret-for-deriving-keys");
    vi.stubEnv("APP_ORIGIN", "https://app.example.com");
    vi.stubEnv("API_BASE_URL", "http://localhost:8080");

    const mockRequest = {
      method: "GET",
      headers: new Map(),
      body: null,
    } as unknown as NextRequest;

    const mockParams: RouteParams = {
      params: Promise.resolve({ path: ["api", "imports"] }),
    };

    const response = await GET(mockRequest, mockParams);
    expect(response.status).toBe(400);
  });
});
