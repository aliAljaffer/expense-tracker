import { defineConfig, devices } from "@playwright/test";

const SESSION_SECRET = process.env.SESSION_SECRET || "test-secret-32-chars-minimum1234567";
const ISSUER_PORT = process.env.ISSUER_PORT || "8900";
const API_PORT = process.env.API_PORT || "8901";
const DB_PORT = process.env.DB_PORT || "5440";
const ISSUER_URL = `http://127.0.0.1:${ISSUER_PORT}`;
const API_BASE_URL = `http://127.0.0.1:${API_PORT}`;
const APP_ORIGIN = `http://127.0.0.1:${process.env.WEB_PORT || "3000"}`;
const USE_REAL_API = process.env.USE_REAL_API === "1";
const CLUSTER = process.env.CLUSTER === "1";

const webServerConfig = CLUSTER
  ? undefined
  : {
      command: `WEB_PORT=${process.env.WEB_PORT || "3000"} ISSUER_PORT=${ISSUER_PORT} ISSUER_URL=${ISSUER_URL} API_PORT=${API_PORT} DB_PORT=${DB_PORT} USE_REAL_API=${USE_REAL_API ? "1" : "0"} node web/e2e/support/start-servers.mjs`,
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
    };

export default defineConfig({
  testDir: "./web/e2e",
  use: {
    baseURL: process.env.E2E_BASE_URL || APP_ORIGIN,
    ...(CLUSTER && {
      launchOptions: {
        args: [
          "--host-resolver-rules=MAP test-issuer.grooszy-dev.svc 127.0.0.1",
        ],
      },
    }),
  },
  webServer: webServerConfig,
});
