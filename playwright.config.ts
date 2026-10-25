import { defineConfig, devices } from "@playwright/test"

// End-to-end tests run against the local stack from `scripts/dev-local.mjs`:
// in-memory MongoDB, fictional seed data, local photo storage, captured email.
// Nothing here can reach production.
const WEB_PORT = process.env.E2E_WEB_PORT || "4121"
const API_PORT = process.env.E2E_API_PORT || "4120"

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    colorScheme: "light",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
  webServer: {
    command: "node scripts/dev-local.mjs",
    url: `http://localhost:${WEB_PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      API_PORT,
      WEB_PORT,
      LOG_LEVEL: "silent",
      RATE_LIMIT_DISABLED: "1",
      REQUIRE_EMAIL_VERIFICATION: "true",
    },
  },
})
