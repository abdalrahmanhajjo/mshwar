import { defineConfig } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";

export default defineConfig({
  testDir: "./src/__tests__/e2e",
  timeout: 30000,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm start -- -p 3001",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
});
