import { defineConfig, devices } from "@playwright/test"

// Browser tests for screens that only exist when the website is BUILT with a
// switch set (a NEXT_PUBLIC_* variable is baked in when Next.js compiles, so
// the main test stack cannot show them).
//
//     npm run test:e2e:switches
//
// This starts a second copy of the website only - no API, no database - with
// NEXT_PUBLIC_DISABLE_EMAIL_VERIFICATION=true and its own build folder, so it
// can run beside the main stack. Nothing here can reach production.
const WEB_PORT = process.env.E2E_SWITCH_WEB_PORT || "4126"
// Deliberately a port nothing listens on: these tests must not need the API.
const API_PORT = process.env.E2E_SWITCH_API_PORT || "4125"

export default defineConfig({
  testDir: "./tests/e2e-switch",
  outputDir: "./test-results-switches",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never", outputFolder: "playwright-report-switches" }]] : [["list"]],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    colorScheme: "light",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } } }],
  webServer: {
    command: `node node_modules/next/dist/bin/next dev -p ${WEB_PORT}`,
    url: `http://localhost:${WEB_PORT}/login`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: {
      NEXT_PUBLIC_DISABLE_EMAIL_VERIFICATION: "true",
      NEXT_PUBLIC_API_URL: `http://localhost:${API_PORT}/api`,
      NEXT_DIST_DIR: process.env.E2E_SWITCH_DIST_DIR || ".next-switches",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
})
