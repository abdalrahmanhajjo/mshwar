import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./src/__tests__/e2e",
  timeout: 30000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001",
    trace: "on-first-retry",
  },
});
