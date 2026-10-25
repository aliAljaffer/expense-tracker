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

    vi.stubGlobal("fetch", async (url: string | URL) => {
      if (String(url).includes("openid-configuration")) {
        return new Response(
          JSON.stringify({
            issuer: "https://example.com/realms/test",
            authorization_endpoint: "https://example.com/realms/test/protocol/openid-connect/auth",
            token_endpoint: "https://example.com/realms/test/protocol/openid-connect/token",
            jwks_uri: "https://example.com/realms/test/protocol/openid-connect/certs",
          }),
          { status: 200 }
        );
      }
      return new Response("", { status: 404 });
    });

    const mockRequest = {
      method: "GET",
      headers: new Map(),
      body: null,
    } as unknown as NextRequest;

    const mockParams: RouteParams = {
      params: Promise.resolve({ path: ["imports"] }),
    };

    const response = await GET(mockRequest, mockParams);
    expect(response.status).toBe(400);
  });

  it("rejects a path outside the allowlist", async () => {
    const { GET } = await import("./[...path]/route");

    const response = await GET(
      { method: "GET", headers: new Headers(), body: null } as unknown as NextRequest,
      { params: Promise.resolve({ path: ["unknown"] }) }
    );

    expect(response.status).toBe(404);
  });

  it("rejects a method the route does not use", async () => {
    const { PUT } = await import("./[...path]/route");

    const response = await PUT(
      { method: "PUT", headers: new Headers(), body: null } as unknown as NextRequest,
      { params: Promise.resolve({ path: ["accounts"] }) }
    );

    expect(response.status).toBe(405);
  });
});
