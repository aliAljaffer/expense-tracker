import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./web/e2e",
  use: { baseURL: "http://127.0.0.1:3000" },
  webServer: {
    command: "npm --prefix web run start",
    url: "http://127.0.0.1:3000/signin",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
