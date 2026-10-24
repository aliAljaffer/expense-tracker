import { describe, it, expect, beforeEach, vi } from "vitest";
import { proxy } from "./proxy";
import { NextRequest } from "next/server";

describe("proxy", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "test-secret-key-for-testing-purposes-at-least-32-chars");
  });

  it("allows access to signin page without session", () => {
    const request = new NextRequest(new URL("http://localhost:3000/signin"));
    const response = proxy(request);

    expect(response.status).toBe(200);
  });

  it("allows access to api/auth routes without session", () => {
    const request = new NextRequest(new URL("http://localhost:3000/api/auth/login"));
    const response = proxy(request);

    expect(response.status).toBe(200);
  });

  it("allows access to static assets without session", () => {
    const request = new NextRequest(new URL("http://localhost:3000/_next/static/test.js"));
    const response = proxy(request);

    expect(response.status).toBe(200);
  });

  it("redirects to signin for protected routes without session", () => {
    const request = new NextRequest(new URL("http://localhost:3000/health"));
    const response = proxy(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/signin");
  });

  it("returns 401 JSON for API paths without session", () => {
    const request = new NextRequest(new URL("http://localhost:3000/api/accounts"));
    const response = proxy(request);

    expect(response.status).toBe(401);
  });
});
