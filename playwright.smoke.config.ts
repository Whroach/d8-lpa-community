import { defineConfig, devices } from "@playwright/test"

// Production-like smoke tests. Started by `npm run smoke:prod`
// (scripts/smoke-prod.mjs), which builds the site, starts it with `next start`,
// starts the API with NODE_ENV=production against an in-memory database and
// local stand-ins for S3 and Mailgun, and passes the addresses in SMOKE_*.
// Nothing here can reach production.
export default defineConfig({
  testDir: "./tests/smoke",
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  outputDir: "test-results-smoke",
  reporter: [["list"]],
  use: {
    baseURL: process.env.SMOKE_WEB_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
})
