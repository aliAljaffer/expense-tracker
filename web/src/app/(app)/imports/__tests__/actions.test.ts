import { describe, it, expect, vi, beforeEach } from "vitest";
import { commitImport, cancelImport } from "../actions";
import { refreshIfExpiring } from "@/lib/auth/session";
import { fetchDiscovery } from "@/lib/auth/oidc";
import { redirect } from "next/navigation";

vi.mock("@/lib/auth/session");
vi.mock("@/lib/auth/oidc");
vi.mock("@/lib/auth/config", () => ({
  getAuthConfig: () => ({
    apiBaseUrl: "http://localhost:8080",
    oidcIssuer: "http://localhost:8080/auth",
    sessionSecret: "test-secret",
    oidcClientId: "test-client",
    oidcClientSecret: "test-secret",
  }),
}));
vi.mock("next/navigation");

// Mock global fetch
global.fetch = vi.fn();

describe("commitImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchDiscovery).mockResolvedValue({
      token_endpoint: "http://localhost:8080/token",
      authorization_endpoint: "http://localhost:8080/auth",
      jwks_uri: "http://localhost:8080/jwks",
      issuer: "http://localhost:8080",
    });
  });

  it("redirects to signin when session is missing", async () => {
    vi.mocked(refreshIfExpiring).mockResolvedValue(null);

    await commitImport(1, [0, 1]);

    expect(redirect).toHaveBeenCalledWith("/signin");
  });

  it("rejects invalid import ID", async () => {
    vi.mocked(refreshIfExpiring).mockResolvedValue({
      accessToken: "token123",
      expiresAt: Date.now() + 1000000,
      refreshToken: "refresh123",
      subject: "test-user",
    });

    const result = await commitImport("invalid", [0, 1]);

    expect(result).toEqual({ error: "Invalid import ID" });
  });

  it("rejects non-array selectedRowIds", async () => {
    vi.mocked(refreshIfExpiring).mockResolvedValue({
      accessToken: "token123",
      expiresAt: Date.now() + 1000000,
      refreshToken: "refresh123",
      subject: "test-user",
    });

    const result = await commitImport(1, "not-an-array");

    expect(result).toEqual({ error: "selectedRowIds must be an array" });
  });

  it("rejects rows array with more than 10000 items", async () => {
    vi.mocked(refreshIfExpiring).mockResolvedValue({
      accessToken: "token123",
      expiresAt: Date.now() + 1000000,
      refreshToken: "refresh123",
      subject: "test-user",
    });

    const longArray = Array(10001).fill(0);
    const result = await commitImport(1, longArray);

    expect(result).toEqual({ error: "Too many rows selected" });
  });

  it("rejects invalid row IDs", async () => {
    vi.mocked(refreshIfExpiring).mockResolvedValue({
      accessToken: "token123",
      expiresAt: Date.now() + 1000000,
      refreshToken: "refresh123",
      subject: "test-user",
    });

    const result = await commitImport(1, [0, "invalid", 2]);

    expect(result).toEqual({ error: "Invalid row ID" });
  });

  it("sends only selected row IDs to API", async () => {
    vi.mocked(refreshIfExpiring).mockResolvedValue({
      accessToken: "token123",
      expiresAt: Date.now() + 1000000,
      refreshToken: "refresh123",
      subject: "test-user",
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ inserted: 2 }),
      headers: new Headers(),
    } as Response);

    await commitImport(42, [0, 2]);

    const commitCall = vi.mocked(global.fetch).mock.calls.find((call) =>
      String(call[0]).includes("/api/imports/42/commit")
    );
    expect(commitCall).toBeDefined();
    expect(commitCall![1]?.headers).toHaveProperty(
      "Authorization",
      "Bearer token123"
    );
    const body = JSON.parse(commitCall![1]?.body as string);
    expect(body).toEqual({ rows: [0, 2] });
  });

  it("returns inserted count on success", async () => {
    vi.mocked(refreshIfExpiring).mockResolvedValue({
      accessToken: "token123",
      expiresAt: Date.now() + 1000000,
      refreshToken: "refresh123",
      subject: "test-user",
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ inserted: 5 }),
      headers: new Headers(),
    } as Response);

    const result = await commitImport(1, [0, 1, 2, 3, 4]);

    expect(result).toEqual({ inserted: 5 });
  });

  it("returns error on API failure", async () => {
    vi.mocked(refreshIfExpiring).mockResolvedValue({
      accessToken: "token123",
      expiresAt: Date.now() + 1000000,
      refreshToken: "refresh123",
      subject: "test-user",
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: "Bad request" }),
      headers: new Headers(),
    } as Response);

    const result = await commitImport(1, [0]);

    expect(result).toEqual({ error: "Bad request" });
  });

  it("includes Bearer token in request headers", async () => {
    vi.mocked(refreshIfExpiring).mockResolvedValue({
      accessToken: "my-secret-token",
      expiresAt: Date.now() + 1000000,
      refreshToken: "refresh123",
      subject: "test-user",
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ inserted: 1 }),
      headers: new Headers(),
    } as Response);

    await commitImport(1, [0]);

    const commitCall = vi.mocked(global.fetch).mock.calls.find((call) =>
      String(call[0]).includes("/api/imports/1/commit")
    );
    const headers = commitCall![1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer my-secret-token");
  });
});

describe("cancelImport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchDiscovery).mockResolvedValue({
      token_endpoint: "http://localhost:8080/token",
      authorization_endpoint: "http://localhost:8080/auth",
      jwks_uri: "http://localhost:8080/jwks",
      issuer: "http://localhost:8080",
    });
  });

  it("redirects to signin when session is missing", async () => {
    vi.mocked(refreshIfExpiring).mockResolvedValue(null);

    await cancelImport(1);

    expect(redirect).toHaveBeenCalledWith("/signin");
  });

  it("rejects invalid import ID", async () => {
    vi.mocked(refreshIfExpiring).mockResolvedValue({
      accessToken: "token123",
      expiresAt: Date.now() + 1000000,
      refreshToken: "refresh123",
      subject: "test-user",
    });

    const result = await cancelImport("invalid");

    expect(result).toEqual({ error: "Invalid import ID" });
  });

  it("sends DELETE request to API", async () => {
    vi.mocked(refreshIfExpiring).mockResolvedValue({
      accessToken: "token123",
      expiresAt: Date.now() + 1000000,
      refreshToken: "refresh123",
      subject: "test-user",
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: new Headers(),
    } as Response);

    await cancelImport(99);

    const deleteCall = vi.mocked(global.fetch).mock.calls.find((call) =>
      String(call[0]).includes("/api/imports/99")
    );
    expect(deleteCall).toBeDefined();
    expect(deleteCall![1]?.method).toBe("DELETE");
    expect((deleteCall![1]?.headers as Record<string, string>).Authorization).toBe(
      "Bearer token123"
    );
  });

  it("returns success on successful cancel", async () => {
    vi.mocked(refreshIfExpiring).mockResolvedValue({
      accessToken: "token123",
      expiresAt: Date.now() + 1000000,
      refreshToken: "refresh123",
      subject: "test-user",
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      headers: new Headers(),
    } as Response);

    const result = await cancelImport(1);

    expect(result).toEqual({ success: true });
  });

  it("returns error on API failure", async () => {
    vi.mocked(refreshIfExpiring).mockResolvedValue({
      accessToken: "token123",
      expiresAt: Date.now() + 1000000,
      refreshToken: "refresh123",
      subject: "test-user",
    });

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
    } as Response);

    const result = await cancelImport(1);

    expect(result).toEqual({ error: "HTTP 404" });
  });
});
