import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { POST } from "./route";
import { createServer, Server, IncomingMessage, ServerResponse } from "http";
import type { NextRequest } from "next/server";

vi.mock("@/lib/auth/session", () => ({
  refreshIfExpiring: vi.fn(),
}));

interface Address {
  port: number;
}

let server: Server;
let port: number;

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server = createServer((req: IncomingMessage, res: ServerResponse) => {
        const body: Buffer[] = [];

        req.on("data", (chunk) => {
          body.push(chunk);
        });

        req.on("end", () => {
          res.writeHead(200, {
            "content-type": "application/json",
            "set-cookie": "upstream=value",
          });
          res.end(JSON.stringify({ import_id: 1 }));
        });
      });

      server.listen(0, () => {
        port = (server.address() as Address).port;
        resolve();
      });
    })
);

afterAll(
  () =>
    new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    })
);

describe("POST /api/imports", () => {
  it("streams upload body with correct content type", async () => {
    const { refreshIfExpiring } = await import("@/lib/auth/session");
    vi.mocked(refreshIfExpiring).mockResolvedValueOnce({
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token",
      expiresAt: Date.now() + 3600 * 1000,
      subject: "test-subject",
    });

    vi.stubEnv("OIDC_ISSUER", "https://example.com/realms/test");
    vi.stubEnv("OIDC_CLIENT_ID", "test-client");
    vi.stubEnv("SESSION_SECRET", "test-secret-for-deriving-keys");
    vi.stubEnv("APP_ORIGIN", "https://app.example.com");
    vi.stubEnv("API_BASE_URL", `http://localhost:${port}`);

    const mockRequest = {
      method: "POST",
      headers: new Map([
        ["origin", "https://app.example.com"],
        ["content-type", "multipart/form-data; boundary=test"],
      ]),
      body: null,
    } as unknown as NextRequest;

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
      if (String(url).includes("/api/imports")) {
        return new Response(JSON.stringify({ import_id: 1 }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "set-cookie": "upstream=value",
          },
        });
      }

      return new Response("", { status: 404 });
    });

    const response = await POST(mockRequest);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 401 when session is missing", async () => {
    vi.stubEnv("OIDC_ISSUER", "https://example.com/realms/test");
    vi.stubEnv("OIDC_CLIENT_ID", "test-client");
    vi.stubEnv("SESSION_SECRET", "test-secret-for-deriving-keys");
    vi.stubEnv("APP_ORIGIN", "https://app.example.com");
    vi.stubEnv("API_BASE_URL", `http://localhost:${port}`);

    const mockRequest = {
      method: "POST",
      headers: new Map([
        ["origin", "https://app.example.com"],
        ["content-type", "multipart/form-data"],
      ]),
      body: null,
    } as unknown as NextRequest;

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
      if (String(url).includes("token")) {
        return new Response("", { status: 401 });
      }
      return new Response("", { status: 404 });
    });

    const response = await POST(mockRequest);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 403 for wrong origin", async () => {
    const { refreshIfExpiring } = await import("@/lib/auth/session");
    vi.mocked(refreshIfExpiring).mockResolvedValueOnce({
      accessToken: "test-access-token",
      refreshToken: "test-refresh-token",
      expiresAt: Date.now() + 3600 * 1000,
      subject: "test-subject",
    });

    vi.stubEnv("OIDC_ISSUER", "https://example.com/realms/test");
    vi.stubEnv("OIDC_CLIENT_ID", "test-client");
    vi.stubEnv("SESSION_SECRET", "test-secret-for-deriving-keys");
    vi.stubEnv("APP_ORIGIN", "https://app.example.com");
    vi.stubEnv("API_BASE_URL", `http://localhost:${port}`);

    const mockRequest = {
      method: "POST",
      headers: new Map([
        ["origin", "https://evil.example.com"],
        ["content-type", "multipart/form-data"],
      ]),
      body: null,
    } as unknown as NextRequest;

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

    const response = await POST(mockRequest);
    expect(response.status).toBe(403);
  });

  it("token does not appear in response", async () => {
    const { refreshIfExpiring } = await import("@/lib/auth/session");
    vi.mocked(refreshIfExpiring).mockResolvedValueOnce({
      accessToken: "test-secret-token-value",
      refreshToken: "test-refresh-token",
      expiresAt: Date.now() + 3600 * 1000,
      subject: "test-subject",
    });

    vi.stubEnv("OIDC_ISSUER", "https://example.com/realms/test");
    vi.stubEnv("OIDC_CLIENT_ID", "test-client");
    vi.stubEnv("SESSION_SECRET", "test-secret-for-deriving-keys");
    vi.stubEnv("APP_ORIGIN", "https://app.example.com");
    vi.stubEnv("API_BASE_URL", `http://localhost:${port}`);

    const mockRequest = {
      method: "POST",
      headers: new Map([
        ["origin", "https://app.example.com"],
        ["content-type", "multipart/form-data"],
      ]),
      body: null,
    } as unknown as NextRequest;

    vi.stubGlobal("fetch", async () => {
      return new Response(JSON.stringify({ import_id: 1 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });

    const response = await POST(mockRequest);
    const body = await response.text();
    expect(body).not.toContain("test-secret-token-value");
  });
});
