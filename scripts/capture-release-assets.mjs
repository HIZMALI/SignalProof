import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { servePages } from "./serve-pages.mjs";

// An isolated, empty browser context; no personal profile or imported storage.
const temporaryDirectory = resolve(".qa/browser-temp");
await mkdir(temporaryDirectory, { recursive: true });
for (const key of ["TMP", "TEMP", "TMPDIR"]) process.env[key] = temporaryDirectory;
const server = await servePages();
let browser;
try {
  browser = await chromium.launch({ channel: "msedge" });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce", locale: "en-GB" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const directory = "docs/release-assets";
  await mkdir(directory, { recursive: true });
  const open = (name) => page.getByRole("button", { name, exact: true }).click();
  const frame = (selector, top = 95) => page.locator(selector).evaluate((element, offset) => scrollTo(0, element.getBoundingClientRect().top + scrollY - offset), top);
  const capture = async (name) => {
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `${directory}/${name}.png`, animations: "disabled" });
  };
  await page.goto("http://127.0.0.1:4177/SignalProof/");
  await page.locator(".result-counts").getByText("3 errors", { exact: true }).waitFor();
  await capture("01-announcement-lab-desktop");
  await open("Corrected closure");
  await open("Channel Lab");
  await page.getByRole("tab", { name: /Push notification/ }).click();
  await frame(".channel-summary");
  await capture("02-push-simulation-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await frame(".push-device", 30);
  await capture("05-push-simulation-mobile");
  await page.setViewportSize({ width: 1600, height: 900 });
  await open("Review & Evidence");
  await open("Create two demo snapshots");
  await page.locator(".comparison-summary").getByText("3 source errors resolved", { exact: false }).waitFor();
  await frame(".comparison-selectors");
  await capture("03-version-comparison-desktop");
  await page.getByRole("tab", { name: "Evidence report" }).click();
  await page.locator(".evidence-report").waitFor();
  await page.locator(".evidence-report").scrollIntoViewIfNeeded();
  await capture("04-evidence-report-desktop");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".evidence-report").scrollIntoViewIfNeeded();
  await capture("06-evidence-report-mobile");
  const store = await page.evaluate(() => JSON.parse(localStorage.getItem("signalproof.evidence.v2")));
  if (store.reviews.length || store.snapshots.some((snapshot) => snapshot.origin !== "demo") || errors.length) throw new Error("Release capture safety or runtime check failed");
  console.log("Captured six real application screenshots: four 1600x900, two 390x844. Fictional built-in data; no review records or runtime errors.");
  await context.close();
} finally {
  await browser?.close();
  await new Promise((done) => server.close(done));
}
