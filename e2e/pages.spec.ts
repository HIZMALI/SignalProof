import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";

async function open(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
}

test("Pages subpath loads every asset and preserves hash navigation and refresh", async ({ page, request }) => {
  const errors: string[] = [];
  const assets = new Set<string>();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("requestfailed", (request) => errors.push(`Failed ${request.url()}`));
  page.on("response", (response) => {
    if (response.url().startsWith("http")) {
      const url = new URL(response.url());
      if (url.origin !== "http://127.0.0.1:4177" || !url.pathname.startsWith("/SignalProof/") || response.status() >= 400) errors.push(`Unexpected response ${response.status()} ${url.pathname}`);
      assets.add(url.pathname);
    }
  });
  await page.goto("./#channels");
  await expect(page.getByRole("tab", { name: /^SMS / })).toBeVisible();
  await expect(page.locator(".sidebar")).toHaveCSS("position", "fixed");
  expect(await page.locator("svg.lucide").count()).toBeGreaterThan(10);
  const favicon = await page.locator('link[rel="icon"]').evaluate((node: HTMLLinkElement) => node.href);
  expect(new URL(favicon).pathname).toBe("/SignalProof/favicon.svg");
  const icon = await request.get(favicon);
  expect(icon.ok()).toBe(true);
  expect(icon.headers()["content-type"]).toContain("image/svg+xml");
  expect(await icon.text()).toContain("<svg");
  expect((await request.get("/assets/missing.js")).status()).toBe(404);
  expect((await request.get("/SignalProof/unknown-page")).status()).toBe(404);
  await open(page, "Announcement lab");
  await open(page, "Channel Lab");
  await page.goBack();
  await expect(page.getByRole("button", { name: /Run validation/ })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("tab", { name: /^SMS / })).toBeVisible();
  for (const [route, view] of [["history", "Validation history"], ["review", "Review & Evidence"], ["rules", "Rulebook"], ["lab", "Announcement lab"]]) {
    await open(page, view);
    await expect(page).toHaveURL(new RegExp(`/SignalProof/#${route}$`));
    await page.reload();
    await expect(page.locator("main")).toBeVisible();
    await expect(page.getByRole("button", { name: view, exact: true })).toHaveAttribute("aria-current", "page");
  }
  expect([...assets].some((path) => /\/assets\/.+\.js$/.test(path))).toBe(true);
  expect([...assets].some((path) => /\/assets\/.+\.css$/.test(path))).toBe(true);
  expect(errors).toEqual([]);
});

test("Pages production demo, channels, browser-local evidence and real downloads work", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("./");
  await expect(page.locator(".result-counts")).toContainText("3 errors");
  await page.getByRole("button", { name: /Run validation/ }).click();
  await open(page, "Corrected closure");
  await expect(page.getByRole("heading", { name: "Applicable checks passed" })).toBeVisible();
  await page.getByRole("button", { name: /Run validation/ }).click();
  await open(page, "Channel Lab");
  for (const name of [/^SMS /, /Push notification/, /^Email /]) {
    await page.getByRole("tab", { name }).click();
    await expect(page.getByRole("table")).toContainText("Included");
  }
  await page.reload();
  await expect(page.locator(".channel-source-strip")).toContainText("0 errors");
  await open(page, "Validation history");
  await expect(page.getByRole("button", { name: "Restore draft" })).toHaveCount(2);
  await open(page, "Compare versions");
  await expect(page.locator(".comparison-summary")).toContainText("3 source errors resolved");
  await page.getByRole("tab", { name: "Human review" }).click();
  await expect(page.getByRole("button", { name: "Complete review — self-attest" })).toBeDisabled();
  await page.getByRole("tab", { name: "Evidence report" }).click();
  await expect(page.locator(".evidence-report")).toBeVisible();
  await mkdir(".qa", { recursive: true });
  const pending = page.waitForEvent("download");
  await open(page, "Export report JSON");
  const file = await pending;
  const path = testInfo.outputPath("report.json");
  await file.saveAs(path);
  const report = JSON.parse(await readFile(path, "utf8"));
  expect(report.snapshot.result.errorCount).toBe(0);
  expect(report.reviews).toEqual([]);
  await page.getByRole("tab", { name: "Backup & restore" }).click();
  const backupPending = page.waitForEvent("download");
  await open(page, "Export evidence backup");
  const backup = await backupPending;
  const backupPath = testInfo.outputPath("backup.json");
  await backup.saveAs(backupPath);
  expect(JSON.parse(await readFile(backupPath, "utf8")).snapshots).toHaveLength(2);
  await open(page, "Announcement lab");
  for (const demo of ["Class cancellation", "Service outage"]) {
    await open(page, demo);
    await expect(page.getByRole("heading", { name: "Applicable checks passed" })).toBeVisible();
  }
  expect(errors).toEqual([]);
});
