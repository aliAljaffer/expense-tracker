import { describe, it, expect, vi } from "vitest";
import { POST } from "./logout/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/auth/session", () => ({
  clearSession: vi.fn(),
}));

vi.mock("@/lib/auth/oidc", () => ({
  fetchDiscovery: vi.fn(() => {
    return Promise.resolve({
      end_session_endpoint: "https://example.com/realms/test/protocol/openid-connect/logout",
    });
  }),
}));

describe("logout route", () => {
  it("returns 403 on cross-origin POST", async () => {
    vi.stubEnv("OIDC_ISSUER", "https://example.com/realms/test");
    vi.stubEnv("OIDC_CLIENT_ID", "test-client");
    vi.stubEnv("SESSION_SECRET", "test-secret-for-deriving-keys");
    vi.stubEnv("APP_ORIGIN", "https://app.example.com");
    vi.stubEnv("API_BASE_URL", "http://localhost:3000");

    const mockRequest = {
      method: "POST",
      headers: new Headers({
        origin: "https://evil.example.com",
      }),
      nextUrl: new URL("https://app.example.com/api/auth/logout"),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);

    expect(response.status).toBe(403);
  });

  it("clears session and redirects on same-origin POST", async () => {
    vi.stubEnv("OIDC_ISSUER", "https://example.com/realms/test");
    vi.stubEnv("OIDC_CLIENT_ID", "test-client");
    vi.stubEnv("SESSION_SECRET", "test-secret-for-deriving-keys");
    vi.stubEnv("APP_ORIGIN", "https://app.example.com");
    vi.stubEnv("API_BASE_URL", "http://localhost:3000");

    const { clearSession } = await import("@/lib/auth/session");

    const mockRequest = {
      method: "POST",
      headers: new Headers({
        origin: "https://app.example.com",
      }),
      nextUrl: new URL("https://app.example.com/api/auth/logout"),
    } as unknown as NextRequest;

    const response = await POST(mockRequest);

    expect(vi.mocked(clearSession)).toHaveBeenCalled();
    expect(response.status).toBe(307);
  });
});
