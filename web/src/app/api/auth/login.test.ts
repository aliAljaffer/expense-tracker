import { describe, it, expect, vi } from "vitest";
import { GET } from "./login/route";

type MockCookieStore = {
  set: ReturnType<typeof vi.fn>;
  has?: ReturnType<typeof vi.fn>;
  get?: ReturnType<typeof vi.fn>;
  getAll?: ReturnType<typeof vi.fn>;
  delete?: ReturnType<typeof vi.fn>;
  clear?: ReturnType<typeof vi.fn>;
  [Symbol.iterator]?: ReturnType<typeof vi.fn>;
  size?: number;
};

vi.mock("next/headers", async () => {
  const actual = await vi.importActual("next/headers");
  return {
    ...actual,
    cookies: vi.fn(async () => ({
      set: vi.fn(),
    })),
  };
});

vi.mock("@/lib/auth/pkce", () => ({
  generateVerifier: () => "test-verifier",
  generateS256Challenge: () => "test-challenge",
  generateState: () => "test-state",
  generateNonce: () => "test-nonce",
}));

vi.mock("@/lib/auth/oidc", () => ({
  buildAuthorizationUrl: vi.fn((params) => {
    const url = new URL(`https://example.com/auth?code_challenge_method=S256`);
    Object.entries(params).forEach(([key, value]) => {
      if (key !== "issuer") {
        url.searchParams.set(key, String(value));
      }
    });
    return url.toString();
  }),
}));

describe("login route", () => {
  it("sets HttpOnly SameSite=Lax PKCE cookie with 10min max age", async () => {
    vi.stubEnv("OIDC_ISSUER", "https://example.com/realms/test");
    vi.stubEnv("OIDC_CLIENT_ID", "test-client");
    vi.stubEnv("SESSION_SECRET", "test-secret-for-deriving-keys");
    vi.stubEnv("APP_ORIGIN", "https://app.example.com");
    vi.stubEnv("API_BASE_URL", "http://localhost:3000");

    const { cookies } = await import("next/headers");
    const mockCookieStore: MockCookieStore = {
      set: vi.fn(),
      has: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      delete: vi.fn(),
      [Symbol.iterator]: vi.fn(),
      size: 0,
      clear: vi.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(cookies).mockResolvedValueOnce(mockCookieStore as any);

    const response = await GET();

    expect(response.status).toBe(307);
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      "et_pkce",
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      })
    );
  });

  it("redirects to authorization URL with code_challenge_method=S256", async () => {
    vi.stubEnv("OIDC_ISSUER", "https://example.com/realms/test");
    vi.stubEnv("OIDC_CLIENT_ID", "test-client");
    vi.stubEnv("SESSION_SECRET", "test-secret-for-deriving-keys");
    vi.stubEnv("APP_ORIGIN", "https://app.example.com");
    vi.stubEnv("API_BASE_URL", "http://localhost:3000");

    const { cookies } = await import("next/headers");
    const mockCookieStore: MockCookieStore = {
      set: vi.fn(),
      has: vi.fn(),
      get: vi.fn(),
      getAll: vi.fn(),
      delete: vi.fn(),
      [Symbol.iterator]: vi.fn(),
      size: 0,
      clear: vi.fn(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(cookies).mockResolvedValueOnce(mockCookieStore as any);

    const response = await GET();

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("code_challenge_method=S256");
    expect(location).toContain("codeChallenge=test-challenge");
  });
});
