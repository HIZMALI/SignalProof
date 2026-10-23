import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile, mkdir } from "node:fs/promises";

const site = "https://hizmali.github.io/SignalProof/";
const errors = new Map<Page, string[]>();
async function open(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
}
async function jsonDownload(page: Page, label: string, path: string) {
  const event = page.waitForEvent("download");
  await open(page, label);
  const download = await event;
  await download.saveAs(path);
  return JSON.parse(await readFile(path, "utf8"));
}
test.beforeEach(async ({ page }) => {
  const issues: string[] = [];
  errors.set(page, issues);
  page.on("pageerror", (error) => issues.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") issues.push(message.text()); });
  page.on("requestfailed", (request) => issues.push(`Failed request: ${request.url()}`));
  page.on("response", (response) => {
    if (response.url().startsWith("https:")) {
      const url = new URL(response.url());
      if (url.origin !== new URL(site).origin || !url.pathname.startsWith("/SignalProof/") || response.status() >= 400) issues.push(`Unexpected HTTP ${response.status()} ${url.pathname}`);
    }
  });
  await mkdir(".qa", { recursive: true });
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
  errors.delete(page);
});

test("live HTTPS assets, branding, direct hash entry, refresh and browser navigation", async ({ page, request }) => {
  const response = await page.goto("./#channels");
  expect(response?.status()).toBe(200);
  expect(response?.url()).toBe(site);
  await expect(page.getByRole("heading", { name: "One message. Three realities." })).toBeVisible();
  await expect(page.locator(".sidebar")).toHaveCSS("position", "fixed");
  expect(await page.locator("svg.lucide").count()).toBeGreaterThan(10);
  const favicon = await page.locator('link[rel="icon"]').evaluate((node: HTMLLinkElement) => node.href);
  expect(favicon).toBe(`${site}favicon.svg`);
  expect((await request.get(favicon)).headers()["content-type"]).toContain("image/svg+xml");
  for (const node of await page.locator('script[src],link[rel="stylesheet"],link[rel="modulepreload"]').all()) {
    const path = await node.evaluate((element) => (element as HTMLScriptElement).src || (element as HTMLLinkElement).href);
    expect(path.startsWith(site)).toBe(true);
    const asset = await request.get(path);
    expect(asset.ok()).toBe(true);
    expect(asset.headers()["content-type"]).toMatch(/javascript|text\/css/);
  }
  await open(page, "Announcement lab");
  await open(page, "Channel Lab");
  await page.goBack();
  await expect(page.getByRole("button", { name: /Run validation/ })).toBeVisible();
  await page.goForward();
  await expect(page.getByRole("tab", { name: /^SMS / })).toBeVisible();
  for (const [route, view] of [["history", "Validation history"], ["review", "Review & Evidence"], ["rules", "Rulebook"], ["lab", "Announcement lab"]]) {
    await page.goto(`./#${route}`);
    await page.reload();
    await expect(page.getByRole("button", { name: view, exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.locator("main")).toBeVisible();
  }
});

test("live source, channels, comparisons, honest review boundary, downloads and validated backup restore", async ({ page, context, browserName }, testInfo) => {
  await page.goto("./");
  await expect(page.locator(".result-counts")).toContainText("3 errors");
  await expect(page.locator(".result-counts")).toContainText("2 warnings");
  await page.getByRole("button", { name: /Run validation/ }).click();
  await open(page, "Corrected closure");
  await expect(page.getByRole("heading", { name: "Applicable checks passed" })).toBeVisible();
  await page.locator("#field-action").fill("");
  await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();
  await open(page, "Corrected closure");
  await page.getByRole("button", { name: /Run validation/ }).click();
  await open(page, "Channel Lab");
  for (const channel of [/^SMS /, /Push notification/, /^Email /]) {
    await page.getByRole("tab", { name: channel }).click();
    await expect(page.getByRole("table").getByText("Included", { exact: true })).toHaveCount(8);
  }
  await page.getByRole("tab", { name: /Push notification/ }).click();
  await expect(page.getByRole("table")).toContainText("Hidden");
  await open(page, "Expand full notification");
  await expect(page.getByRole("button", { name: "Collapse notification" })).toHaveAttribute("aria-expanded", "true");
  await open(page, "Collapse notification");
  if (browserName === "chromium") {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(site).origin });
    await open(page, "Copy full push payload");
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("Use the East Gate");
  }
  await page.getByRole("tab", { name: /^SMS / }).click();
  await expect(page.locator(".channel-metrics")).toContainText(/segment/i);
  const textEvent = page.waitForEvent("download");
  await page.locator(".channel-exportbar").getByRole("button", { name: "Download .txt" }).click();
  const text = await textEvent;
  const textPath = testInfo.outputPath("sms.txt");
  await text.saveAs(textPath);
  expect(await readFile(textPath, "utf8")).toContain("Use the East Gate");
  await open(page, "Review & Evidence");
  await open(page, "Create two demo snapshots");
  await expect(page.locator(".comparison-summary")).toContainText("3 source errors resolved");
  const before = await page.getByLabel("Before snapshot").inputValue();
  const after = await page.getByLabel("After snapshot").inputValue();
  await page.getByLabel("Before snapshot").selectOption(after);
  await page.getByLabel("After snapshot").selectOption(before);
  await expect(page.locator(".comparison-summary")).toContainText("5 new source issues introduced");
  await page.getByLabel("Before snapshot").selectOption(before);
  await page.getByLabel("After snapshot").selectOption(after);
  await page.reload();
  await page.getByRole("tab", { name: "Human review" }).click();
  await expect(page.getByRole("button", { name: "Complete review — self-attest" })).toBeDisabled();
  await expect(page.locator(".review-record")).toHaveCount(0);
  await page.getByRole("tab", { name: "Evidence report" }).click();
  const report = await jsonDownload(page, "Export report JSON", testInfo.outputPath("report.json"));
  expect(report.snapshot.result.errorCount).toBe(0);
  expect(report.reviews).toEqual([]);
  await page.getByRole("tab", { name: "Backup & restore" }).click();
  const backupPath = testInfo.outputPath("backup.json");
  const backup = await jsonDownload(page, "Export evidence backup", backupPath);
  expect(backup.snapshots).toHaveLength(4);
  expect(backup.reviews).toEqual([]);
  await open(page, "Clear local evidence…");
  await open(page, "Clear evidence only");
  await page.getByLabel("Import evidence backup").setInputFiles(backupPath);
  await expect(page.getByRole("dialog")).toBeVisible();
  await open(page, "Import records");
  await expect(page.getByText("4 / 50 snapshots")).toBeVisible();
  await page.reload();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("signalproof.evidence.v2")!));
  expect(stored.snapshots).toHaveLength(4);
  expect(stored.reviews).toEqual([]);
});

test("live IANA/DST behavior, four responsive widths and independent browser storage", async ({ page, browser }) => {
  await page.goto("./");
  await open(page, "Corrected closure");
  await page.getByLabel("Time zone mode").selectOption("iana");
  await page.locator("#field-timeZone").fill("America/New_York");
  await page.locator("#field-startTime").fill("2026-03-08T02:30");
  await expect(page.locator("#time-resolution-startTime")).toContainText("does not exist");
  await page.locator("#field-startTime").fill("2026-11-01T01:50");
  await page.locator("#field-endTime").fill("2026-11-01T01:10");
  await expect(page.getByLabel("Start occurrence")).toHaveValue("");
  await page.getByLabel("Start occurrence").selectOption("earlier");
  await page.getByLabel("End occurrence").selectOption("later");
  await expect(page.getByRole("heading", { name: "Applicable checks passed" })).toBeVisible();
  await expect(page.locator("#time-resolution-startTime")).toContainText("UTC-04:00");
  await expect(page.locator("#time-resolution-endTime")).toContainText("UTC-05:00");
  await page.getByRole("button", { name: /Run validation/ }).click();
  await open(page, "Review & Evidence");
  await open(page, "Create two demo snapshots");
  for (const width of [1920, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1080 });
    for (const view of ["Announcement lab", "Channel Lab", "Review & Evidence"]) {
      await open(page, view);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
    await page.getByRole("tab", { name: "Evidence report" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`live-${width}.png`) });
  }
  const separate = await browser.newContext();
  try {
    const other = await separate.newPage();
    await other.goto(site);
    expect(await other.evaluate(() => localStorage.getItem("signalproof.evidence.v2"))).toBeNull();
    await expect(other.locator(".result-counts")).toContainText("3 errors");
  } finally { await separate.close(); }
});
