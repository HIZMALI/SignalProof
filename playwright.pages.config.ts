import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "pages.spec.ts",
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 7000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4177/SignalProof/",
    viewport: { width: 1600, height: 900 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: process.env.CI
    ? [{ name: "chromium", use: { browserName: "chromium" } }]
    : [
        { name: "edge", use: { browserName: "chromium", channel: "msedge" } },
        { name: "firefox", use: { browserName: "firefox" } },
        { name: "webkit", use: { browserName: "webkit" } },
      ],
  webServer: {
    command: "node scripts/serve-pages.mjs",
    url: "http://127.0.0.1:4177/SignalProof/",
    reuseExistingServer: false,
    timeout: 30_000,
  },
});
