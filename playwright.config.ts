import { defineConfig } from "@playwright/test";

const SESSION_SECRET = process.env.SESSION_SECRET || "test-secret-32-chars-minimum1234567";
const ISSUER_PORT = process.env.ISSUER_PORT || "8900";
const API_PORT = process.env.API_PORT || "8901";
const ISSUER_URL = `http://127.0.0.1:${ISSUER_PORT}`;
const API_BASE_URL = `http://127.0.0.1:${API_PORT}`;
const APP_ORIGIN = "http://127.0.0.1:3000";

export default defineConfig({
  testDir: "./web/e2e",
  use: { baseURL: APP_ORIGIN },
  webServer: {
    command: `ISSUER_PORT=${ISSUER_PORT} ISSUER_URL=${ISSUER_URL} API_PORT=${API_PORT} node web/e2e/support/start-servers.mjs`,
    url: `${APP_ORIGIN}/signin`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      OIDC_ISSUER: ISSUER_URL,
      OIDC_CLIENT_ID: "test-client",
      SESSION_SECRET,
      APP_ORIGIN,
      API_BASE_URL,
    },
  },
});
