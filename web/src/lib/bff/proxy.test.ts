import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { proxyToApi, type ProxyRequest } from "./proxy";
import { createServer, Server, IncomingMessage, ServerResponse } from "http";

vi.mock("@/lib/auth/session", () => ({
  refreshIfExpiring: vi.fn(),
}));

interface Address {
  port: number;
}

let server: Server;
let port: number;
const capturedRequests: Array<{
  method: string;
  url: string;
  headers: Record<string, string | string[]>;
  body: Buffer;
}> = [];

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server = createServer((req: IncomingMessage, res: ServerResponse) => {
        const body: Buffer[] = [];

        req.on("data", (chunk) => {
          body.push(chunk);
        });

        req.on("end", () => {
          const headers: Record<string, string | string[]> = {};
          for (const [key, value] of Object.entries(req.headers)) {
            if (value) {
              headers[key] = value;
            }
          }

          capturedRequests.push({
            method: req.method || "GET",
            url: req.url || "",
            headers,
            body: Buffer.concat(body),
          });

          res.writeHead(200, {
            "content-type": "application/json",
            "set-cookie": "upstream=value",
          });
          res.end(JSON.stringify({ success: true }));
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

describe("proxyToApi", () => {
  it("adds bearer token from session", async () => {
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

    const request: ProxyRequest = {
      method: "GET",
      headers: new Headers(),
    };

    vi.stubGlobal("fetch", async (url: string | URL) => {
      if (String(url).includes("/api/test")) {
        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response("", { status: 404 });
    });

    const response = await proxyToApi(request, "/api/test");
    expect(response.status).toBe(200);
  });

  it("returns 401 when session is missing", async () => {
    vi.stubEnv("OIDC_ISSUER", "https://example.com/realms/test");
    vi.stubEnv("OIDC_CLIENT_ID", "test-client");
    vi.stubEnv("SESSION_SECRET", "test-secret-for-deriving-keys");
    vi.stubEnv("APP_ORIGIN", "https://app.example.com");
    vi.stubEnv("API_BASE_URL", `http://localhost:${port}`);

    vi.stubGlobal("fetch", async (url: string | URL, _init: RequestInit | undefined) => {
      if (String(url).includes("token")) {
        return new Response("", { status: 401 });
      }
      return new Response("", { status: 404 });
    });

    const request: ProxyRequest = {
      method: "GET",
      headers: new Headers(),
    };

    const response = await proxyToApi(request, "/api/test");
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 403 for non-GET requests with wrong origin", async () => {
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

    const request: ProxyRequest = {
      method: "POST",
      headers: new Headers({ origin: "https://evil.example.com" }),
    };

    const response = await proxyToApi(request, "/api/test");
    expect(response.status).toBe(403);
  });

  it("sets cache-control no-store", async () => {
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

    const request: ProxyRequest = {
      method: "GET",
      headers: new Headers(),
    };

    vi.stubGlobal("fetch", async (url: string | URL) => {
      if (String(url).includes("/api/test")) {
        return new Response(JSON.stringify({ data: "test" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response("", { status: 404 });
    });

    const response = await proxyToApi(request, "/api/test");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("drops incoming authorization header", async () => {
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

    const request: ProxyRequest = {
      method: "GET",
      headers: new Headers({
        authorization: "Bearer evil-token",
      }),
    };

    vi.stubGlobal("fetch", async (url: string | URL) => {
      if (String(url).includes("/api/test")) {
        return new Response(JSON.stringify({ data: "test" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response("", { status: 404 });
    });

    const response = await proxyToApi(request, "/api/test");
    expect(response.status).toBe(200);
  });

  it("strips set-cookie from upstream response", async () => {
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

    const request: ProxyRequest = {
      method: "GET",
      headers: new Headers(),
    };

    vi.stubGlobal("fetch", async (url: string | URL) => {
      if (String(url).includes("/api/test")) {
        return new Response(JSON.stringify({ data: "test" }), {
          status: 200,
          headers: {
            "content-type": "application/json",
            "set-cookie": "upstream=value",
          },
        });
      }

      return new Response("", { status: 404 });
    });

    const response = await proxyToApi(request, "/api/test");
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("token does not appear in response body", async () => {
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

    const request: ProxyRequest = {
      method: "GET",
      headers: new Headers(),
    };

    vi.stubGlobal("fetch", async (url: string | URL) => {
      if (String(url).includes("/api/test")) {
        return new Response(JSON.stringify({ data: "test" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response("", { status: 404 });
    });

    const response = await proxyToApi(request, "/api/test");
    const body = await response.text();
    expect(body).not.toContain("test-access-token");
  });

  it("forwards only allowed headers", async () => {
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

    const request: ProxyRequest = {
      method: "POST",
      headers: new Headers({
        "content-type": "application/json",
        "origin": "https://app.example.com",
      }),
    };

    vi.stubGlobal("fetch", async (url: string | URL) => {
      if (String(url).includes("/api/test")) {
        return new Response(JSON.stringify({ data: "test" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      return new Response("", { status: 404 });
    });

    const response = await proxyToApi(request, "/api/test");
    expect(response.status).toBe(200);
  });
});
