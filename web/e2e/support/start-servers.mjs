#!/usr/bin/env node

import { spawn, execSync } from "child_process";

const ISSUER_PORT = process.env.ISSUER_PORT || "8900";
const API_PORT = process.env.API_PORT || "8901";
const DB_PORT = process.env.DB_PORT || "5440";
const ISSUER_URL = process.env.ISSUER_URL || `http://127.0.0.1:${ISSUER_PORT}`;
const API_BASE_URL = `http://127.0.0.1:${API_PORT}`;
const APP_ORIGIN = `http://127.0.0.1:${process.env.WEB_PORT || "3000"}`;
const SESSION_SECRET = process.env.SESSION_SECRET || "test-secret-32-chars-minimum1234567";
const OIDC_CLIENT_ID = process.env.OIDC_CLIENT_ID || "test-client";
const DB_PASSWORD = "test";
const OIDC_OWNER_SUBJECT = "test-subject-123";
const DATABASE_URL = `postgres://postgres:${DB_PASSWORD}@127.0.0.1:${DB_PORT}/test?sslmode=disable`;

// Check if running real API tests (Phase 5W+)
const USE_REAL_API = process.env.USE_REAL_API === "1";

const servers = [
  {
    name: "test-issuer",
    command: "node",
    args: ["web/e2e/support/test-issuer.mjs"],
    env: {
      ISSUER_PORT: ISSUER_PORT.toString(),
      ISSUER_URL,
      ACCESS_TOKEN_LIFETIME: "5",
    },
  },
];

if (USE_REAL_API) {
  console.log("Running migrations for real API...");
  try {
    execSync(`go run ./cmd/run-e2e-migrations`, {
      env: { ...process.env, DATABASE_URL },
      stdio: "inherit",
    });
    console.log("Migrations completed");
  } catch (error) {
    console.error("Failed to run migrations:", error.message);
    process.exit(1);
  }

  servers.push({
    name: "go-api",
    command: "go",
    args: ["run", "./cmd/api"],
    env: {
      DATABASE_URL,
      OIDC_ISSUER: ISSUER_URL,
      OIDC_AUDIENCE: OIDC_CLIENT_ID,
      OIDC_OWNER_SUBJECT,
      LISTEN_ADDR: `:${API_PORT}`,
    },
  });
} else {
  servers.push({
    name: "fake-api",
    command: "node",
    args: ["web/e2e/support/fake-api.mjs"],
    env: {
      API_PORT: API_PORT.toString(),
    },
  });
}

servers.push({
  name: "next-app",
  command: "npm",
  args: ["--prefix", "web", "run", "start"],
  env: {
    PORT: process.env.WEB_PORT || "3000",
    OIDC_ISSUER: ISSUER_URL,
    OIDC_CLIENT_ID: OIDC_CLIENT_ID,
    SESSION_SECRET,
    APP_ORIGIN,
    API_BASE_URL,
  },
});

const processes = [];

async function startServers() {
  for (const server of servers) {
    console.log(`Starting ${server.name}...`);
    const env = { ...process.env, ...server.env };
    const proc = spawn(server.command, server.args, { env });

    proc.stdout.on("data", (data) => {
      console.log(`[${server.name}] ${data.toString().trim()}`);
    });

    proc.stderr.on("data", (data) => {
      console.error(`[${server.name}] ${data.toString().trim()}`);
    });

    proc.on("error", (error) => {
      console.error(`[${server.name}] Error:`, error);
    });

    processes.push(proc);
  }

  console.log("All servers started. Press Ctrl+C to stop.");
}

function stopServers() {
  processes.forEach((proc) => {
    proc.kill();
  });
  process.exit(0);
}

process.on("SIGINT", stopServers);
process.on("SIGTERM", stopServers);

startServers();
