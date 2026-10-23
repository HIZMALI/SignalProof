import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "live.spec.ts",
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 12_000 },
  reporter: [["list"], ["json", { outputFile: ".qa/live-results.json" }]],
  use: {
    baseURL: "https://hizmali.github.io/SignalProof/",
    viewport: { width: 1920, height: 1080 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "edge", use: { browserName: "chromium", channel: "msedge" } },
    { name: "firefox", use: { browserName: "firefox" } },
    { name: "webkit", use: { browserName: "webkit" } },
  ],
});
