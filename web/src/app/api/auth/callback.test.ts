import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { GET } from "./callback/route";
import { NextRequest } from "next/server";
import { createServer, Server, IncomingMessage, ServerResponse } from "http";

type MockCookieStore = {
  get: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  has?: ReturnType<typeof vi.fn>;
  getAll?: ReturnType<typeof vi.fn>;
  set?: ReturnType<typeof vi.fn>;
  clear?: ReturnType<typeof vi.fn>;
  [Symbol.iterator]?: ReturnType<typeof vi.fn>;
  size?: number;
};

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/auth/oidc", () => ({
  parseIdToken: vi.fn(),
  exchangeCode: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  writeSession: vi.fn(),
}));

let server: Server;

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      server = createServer((req: IncomingMessage, res: ServerResponse) => {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ access_token: "test-token", expires_in: 3600 }));
      });

      server.listen(0, () => {
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

describe("callback route", () => {
  it("rejects missing PKCE cookie", async () => {
    vi.stubEnv("OIDC_ISSUER", "https://example.com/realms/test");
    vi.stubEnv("OIDC_CLIENT_ID", "test-client");
    vi.stubEnv("SESSION_SECRET", "test-secret-for-deriving-keys");
    vi.stubEnv("APP_ORIGIN", "https://app.example.com");
    vi.stubEnv("API_BASE_URL", "http://localhost:3000");

    const { cookies } = await import("next/headers");
    const mockCookieStore: MockCookieStore = {
      get: vi.fn(() => undefined),
      delete: vi.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(cookies).mockResolvedValueOnce(mockCookieStore as any);

    const mockRequest = {
      nextUrl: new URL("https://app.example.com/api/auth/callback?code=test-code&state=test-state"),
      headers: new Headers(),
    } as unknown as NextRequest;

    const response = await GET(mockRequest);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/signin?error=invalid_session");
  });

  it("redirects with error parameter without exposing raw error text", async () => {
    vi.stubEnv("OIDC_ISSUER", "https://example.com/realms/test");
    vi.stubEnv("OIDC_CLIENT_ID", "test-client");
    vi.stubEnv("SESSION_SECRET", "test-secret-for-deriving-keys");
    vi.stubEnv("APP_ORIGIN", "https://app.example.com");
    vi.stubEnv("API_BASE_URL", "http://localhost:3000");

    const { cookies } = await import("next/headers");
    const mockCookieStore: MockCookieStore = {
      get: vi.fn(),
      delete: vi.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(cookies).mockResolvedValueOnce(mockCookieStore as any);

    const mockRequest = {
      nextUrl: new URL("https://app.example.com/api/auth/callback?error=access_denied&error_description=user_denied"),
      headers: new Headers(),
    } as unknown as NextRequest;

    const response = await GET(mockRequest);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBe("https://app.example.com/signin?error=access_denied");
    expect(location).not.toContain("access_denied&error_description=user_denied");
  });

  it("rejects missing state parameter", async () => {
    vi.stubEnv("OIDC_ISSUER", "https://example.com/realms/test");
    vi.stubEnv("OIDC_CLIENT_ID", "test-client");
    vi.stubEnv("SESSION_SECRET", "test-secret-for-deriving-keys");
    vi.stubEnv("APP_ORIGIN", "https://app.example.com");
    vi.stubEnv("API_BASE_URL", "http://localhost:3000");

    const { cookies } = await import("next/headers");
    const mockCookieStore: MockCookieStore = {
      get: vi.fn(() => ({ value: "dummy" })),
      delete: vi.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(cookies).mockResolvedValueOnce(mockCookieStore as any);

    const mockRequest = {
      nextUrl: new URL("https://app.example.com/api/auth/callback?code=test-code"),
      headers: new Headers(),
    } as unknown as NextRequest;

    const response = await GET(mockRequest);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/signin?error=missing_params");
    expect(mockCookieStore.delete).toHaveBeenCalledWith("et_pkce");
  });

  it("rejects mismatched state parameter", async () => {
    vi.stubEnv("OIDC_ISSUER", "https://example.com/realms/test");
    vi.stubEnv("OIDC_CLIENT_ID", "test-client");
    vi.stubEnv("SESSION_SECRET", "test-secret-for-deriving-keys");
    vi.stubEnv("APP_ORIGIN", "https://app.example.com");
    vi.stubEnv("API_BASE_URL", "http://localhost:3000");

    const { cookies } = await import("next/headers");
    const mockCookieStore: MockCookieStore = {
      get: vi.fn(() => ({ value: "invalid-base64" })),
      delete: vi.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(cookies).mockResolvedValueOnce(mockCookieStore as any);

    const mockRequest = {
      nextUrl: new URL("https://app.example.com/api/auth/callback?code=test-code&state=attacker-state"),
      headers: new Headers(),
    } as unknown as NextRequest;

    const response = await GET(mockRequest);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/signin?error=invalid_pkce");
    expect(mockCookieStore.delete).toHaveBeenCalledWith("et_pkce");
  });
});
