import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getAuthConfig } from "./config";

describe("config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns config when all required vars are set", () => {
    process.env.OIDC_ISSUER = "https://keycloak.example.com/realms/homelab";
    process.env.OIDC_CLIENT_ID = "expense-tracker";
    process.env.SESSION_SECRET = "test-secret-key-at-least-32-chars!";
    process.env.APP_ORIGIN = "https://expenses.example.com";
    process.env.API_BASE_URL = "https://api.example.com";

    const config = getAuthConfig();

    expect(config.oidcIssuer).toBe("https://keycloak.example.com/realms/homelab");
    expect(config.oidcClientId).toBe("expense-tracker");
    expect(config.sessionSecret).toBe("test-secret-key-at-least-32-chars!");
    expect(config.appOrigin).toBe("https://expenses.example.com");
    expect(config.apiBaseUrl).toBe("https://api.example.com");
    expect(config.oidcClientSecret).toBeUndefined();
  });

  it("includes OIDC_CLIENT_SECRET when set", () => {
    process.env.OIDC_ISSUER = "https://keycloak.example.com/realms/homelab";
    process.env.OIDC_CLIENT_ID = "expense-tracker";
    process.env.OIDC_CLIENT_SECRET = "secret-value";
    process.env.SESSION_SECRET = "test-secret-key-at-least-32-chars!";
    process.env.APP_ORIGIN = "https://expenses.example.com";
    process.env.API_BASE_URL = "https://api.example.com";

    const config = getAuthConfig();

    expect(config.oidcClientSecret).toBe("secret-value");
  });

  it("throws when OIDC_ISSUER is missing", () => {
    delete process.env.OIDC_ISSUER;
    process.env.OIDC_CLIENT_ID = "expense-tracker";
    process.env.SESSION_SECRET = "test-secret-key-at-least-32-chars!";
    process.env.APP_ORIGIN = "https://expenses.example.com";
    process.env.API_BASE_URL = "https://api.example.com";

    expect(() => getAuthConfig()).toThrow(
      "Missing required environment variable: OIDC_ISSUER"
    );
  });

  it("throws when OIDC_CLIENT_ID is missing", () => {
    process.env.OIDC_ISSUER = "https://keycloak.example.com/realms/homelab";
    delete process.env.OIDC_CLIENT_ID;
    process.env.SESSION_SECRET = "test-secret-key-at-least-32-chars!";
    process.env.APP_ORIGIN = "https://expenses.example.com";
    process.env.API_BASE_URL = "https://api.example.com";

    expect(() => getAuthConfig()).toThrow(
      "Missing required environment variable: OIDC_CLIENT_ID"
    );
  });

  it("throws when SESSION_SECRET is missing", () => {
    process.env.OIDC_ISSUER = "https://keycloak.example.com/realms/homelab";
    process.env.OIDC_CLIENT_ID = "expense-tracker";
    delete process.env.SESSION_SECRET;
    process.env.APP_ORIGIN = "https://expenses.example.com";
    process.env.API_BASE_URL = "https://api.example.com";

    expect(() => getAuthConfig()).toThrow(
      "Missing required environment variable: SESSION_SECRET"
    );
  });

  it("throws when APP_ORIGIN is missing", () => {
    process.env.OIDC_ISSUER = "https://keycloak.example.com/realms/homelab";
    process.env.OIDC_CLIENT_ID = "expense-tracker";
    process.env.SESSION_SECRET = "test-secret-key-at-least-32-chars!";
    delete process.env.APP_ORIGIN;
    process.env.API_BASE_URL = "https://api.example.com";

    expect(() => getAuthConfig()).toThrow(
      "Missing required environment variable: APP_ORIGIN"
    );
  });

  it("throws when API_BASE_URL is missing", () => {
    process.env.OIDC_ISSUER = "https://keycloak.example.com/realms/homelab";
    process.env.OIDC_CLIENT_ID = "expense-tracker";
    process.env.SESSION_SECRET = "test-secret-key-at-least-32-chars!";
    process.env.APP_ORIGIN = "https://expenses.example.com";
    delete process.env.API_BASE_URL;

    expect(() => getAuthConfig()).toThrow(
      "Missing required environment variable: API_BASE_URL"
    );
  });
});
