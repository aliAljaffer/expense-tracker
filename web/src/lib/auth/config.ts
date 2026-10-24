import "server-only";

interface AuthConfig {
  oidcIssuer: string;
  oidcIssuerBrowser: string;
  oidcClientId: string;
  oidcClientSecret: string | undefined;
  sessionSecret: string;
  appOrigin: string;
  apiBaseUrl: string;
}

export function getAuthConfig(): AuthConfig {
  const oidcIssuer = process.env.OIDC_ISSUER;
  if (!oidcIssuer) {
    throw new Error("Missing required environment variable: OIDC_ISSUER");
  }

  const oidcClientId = process.env.OIDC_CLIENT_ID;
  if (!oidcClientId) {
    throw new Error("Missing required environment variable: OIDC_CLIENT_ID");
  }

  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error("Missing required environment variable: SESSION_SECRET");
  }

  const appOrigin = process.env.APP_ORIGIN;
  if (!appOrigin) {
    throw new Error("Missing required environment variable: APP_ORIGIN");
  }

  const apiBaseUrl = process.env.API_BASE_URL;
  if (!apiBaseUrl) {
    throw new Error("Missing required environment variable: API_BASE_URL");
  }

  let oidcIssuerBrowser = process.env.OIDC_ISSUER_BROWSER || oidcIssuer;

  if (!process.env.OIDC_ISSUER_BROWSER && appOrigin.includes("127.0.0.1") && oidcIssuer.includes(".svc")) {
    const issuerUrl = new URL(oidcIssuer);
    oidcIssuerBrowser = `http://127.0.0.1:${issuerUrl.port || 8900}`;
  }

  return {
    oidcIssuer,
    oidcIssuerBrowser,
    oidcClientId,
    oidcClientSecret: process.env.OIDC_CLIENT_SECRET,
    sessionSecret,
    appOrigin,
    apiBaseUrl,
  };
}
