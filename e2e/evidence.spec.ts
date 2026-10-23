import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";

async function openReview(page: Page) {
  await page
    .getByRole("button", { name: "Review & Evidence", exact: true })
    .click();
}
async function expectNoOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
}
test.beforeEach(async ({ page }) => {
  await page.goto("/");
});

test("records, reloads, restores and compares actual demo evidence in both directions", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.getByRole("button", { name: /Run validation/ }).click();
  await page
    .getByRole("button", { name: "Corrected closure", exact: true })
    .click();
  await page.getByRole("button", { name: /Run validation/ }).click();
  await page.reload();
  await page
    .getByRole("button", { name: "Validation history", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Restore draft" })).toHaveCount(
    2,
  );
  await page.getByRole("button", { name: "Restore draft" }).last().click();
  await expect(
    page.getByLabel("Alternative entrance", { exact: false }),
  ).toHaveValue("");
  await page
    .getByRole("button", { name: "Validation history", exact: true })
    .click();
  await page.getByRole("button", { name: "Compare versions" }).click();
  await expect(page.locator(".comparison-summary")).toContainText(
    "3 source errors resolved",
  );
  const before = await page.getByLabel("Before snapshot").inputValue();
  const after = await page.getByLabel("After snapshot").inputValue();
  await page.getByLabel("Before snapshot").selectOption(after);
  await page.getByLabel("After snapshot").selectOption(before);
  await expect(page.locator(".comparison-summary")).toContainText(
    "5 new source issues introduced",
  );
  await page.getByLabel("After snapshot").selectOption(after);
  await expect(
    page.getByText("The same snapshot is selected twice.", { exact: false }),
  ).toBeVisible();
  await expectAccessible(page);
  expect(errors).toEqual([]);
});

test("requires explicit human responses, binds content and configuration, and retains historical review", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Corrected closure", exact: true })
    .click();
  await openReview(page);
  await page.getByRole("button", { name: "Record first snapshot" }).click();
  const complete = page.getByRole("button", {
    name: "Complete review — self-attest",
  });
  await expect(complete).toBeDisabled();
  await page
    .getByLabel("Reviewer display name", { exact: false })
    .fill("Illustrative browser test reviewer");
  await page
    .getByLabel("Review notes", { exact: true })
    .fill(
      "Fictional demo facts only; automated QA does not verify a real source.",
    );
  const checks = page.getByRole("checkbox");
  const count = await checks.count();
  for (let i = 0; i < count - 1; i++) await checks.nth(i).check();
  await expect(complete).toBeDisabled();
  await checks.last().check();
  await expect(complete).toBeEnabled();
  await complete.click();
  await expect(page.locator(".review-record summary")).toContainText(
    "Review completed — self-attested",
  );
  await page.getByRole("button", { name: "Channel Lab", exact: true }).click();
  await page.getByRole("tab", { name: /Push notification/ }).click();
  await expect(page.locator(".global-review-notice")).toHaveCount(0);
  await page.getByLabel("Generic card preset").selectOption("roomy");
  await expect(page.locator(".global-review-notice")).toContainText(
    "Content changed since review. Re-review required.",
  );
  await page.getByLabel("Generic card preset").selectOption("compact");
  await expect(page.locator(".global-review-notice")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Announcement lab", exact: true })
    .click();
  await page
    .getByLabel("Required action", { exact: false })
    .fill("Changed action for regression test");
  await expect(page.locator(".global-review-notice")).toBeVisible();
  await page.reload();
  await openReview(page);
  await page.locator(".review-record summary").click();
  await expect(page.locator(".review-record")).toContainText("outdated");
  await expect(page.locator(".review-record")).toContainText(
    "Fictional demo facts only",
  );
  await expectAccessible(page);
});

test("exports real JSON, confirms merge/clear, rejects conflicts, and preserves the working draft", async ({
  page,
}) => {
  await mkdir(".qa", { recursive: true });
  await openReview(page);
  await page.getByRole("button", { name: "Create two demo snapshots" }).click();
  await page.getByRole("tab", { name: "Backup & restore" }).click();
  const draft = await page.evaluate(() =>
    localStorage.getItem("signalproof.draft.v2"),
  );
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export evidence backup" }).click();
  const download = await downloadEvent;
  const path = ".qa/evidence-backup.json";
  await download.saveAs(path);
  const backup = JSON.parse(await readFile(path, "utf8"));
  expect(backup.snapshots).toHaveLength(2);
  expect(backup.reviews).toEqual([]);
  await page.getByRole("button", { name: "Clear local evidence…" }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Clear local evidence…" }),
  ).toBeFocused();
  await expect(page.getByText("2 / 50 snapshots")).toBeVisible();
  await page.getByRole("button", { name: "Clear local evidence…" }).click();
  await page.getByRole("button", { name: "Clear evidence only" }).click();
  await page.getByLabel("Import evidence backup").setInputFiles(path);
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("signalproof.evidence.v2")!).snapshots
          .length,
    ),
  ).toBe(0);
  await page
    .getByRole("button", { name: "Import records", exact: true })
    .click();
  await expect(page.getByText("2 / 50 snapshots")).toBeVisible();
  await page.getByLabel("Import evidence backup").setInputFiles(path);
  await expect(page.getByRole("dialog")).toContainText(
    "2 identical duplicates skipped",
  );
  await page
    .getByRole("button", { name: "Import records", exact: true })
    .click();
  const conflict = structuredClone(backup);
  conflict.snapshots[0].origin = "recorded";
  await page.getByLabel("Import evidence backup").setInputFiles({
    name: "conflict.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(conflict)),
  });
  await expect(page.locator(".evidence-error")).toContainText(
    "Conflicting snapshots ID",
  );
  await page.getByLabel("Import evidence backup").setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"kind":"signalproof-evidence","version":999}'),
  });
  await expect(page.locator(".evidence-error")).toContainText(
    "Unknown or legacy",
  );
  expect(
    await page.evaluate(() => localStorage.getItem("signalproof.draft.v2")),
  ).toBe(draft);
  await expectAccessible(page);
});

test("renders usable layouts at 1440, 768, 390 and 320 and a light complete print report", async ({
  page,
  context,
  browserName,
}) => {
  await mkdir(".qa/screenshots", { recursive: true });
  if (browserName === "chromium")
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const capture = (name: string) =>
    browserName === "chromium"
      ? `.qa/screenshots/build04-${name}.png`
      : `.qa/${browserName}-${name}.png`;
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await openReview(page);
  await page.getByRole("button", { name: "Create two demo snapshots" }).click();
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.getByRole("tab", { name: "Compare versions" }).click();
    await expectNoOverflow(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    if (width === 1440 || width === 390)
      await page.screenshot({
        path: capture(`compare-${width}`),
      });
    if (width === 390) {
      await page
        .locator(".comparison-grid")
        .first()
        .screenshot({
          path: capture("comparison-cards-390"),
        });
    }
    await page.getByRole("tab", { name: "Human review" }).click();
    await expectNoOverflow(page);
    await page.getByRole("tab", { name: "Evidence report" }).click();
    await expectNoOverflow(page);
    await page
      .getByRole("button", { name: "Channel Lab", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Corrected closure", exact: true })
      .click();
    for (const channel of [/^SMS /, /Push notification/, /^Email /]) {
      await page.getByRole("tab", { name: channel }).click();
      await expectNoOverflow(page);
    }
    await openReview(page);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("tab", { name: "Human review" }).click();
  await expectAccessible(page);
  await page.getByRole("button", { name: "Channel Lab", exact: true }).click();
  await page.getByRole("tab", { name: /Push notification/ }).click();
  await expectAccessible(page);
  await expect(page.locator(".visibility-warning-summary")).toContainText(
    "required action remains visible",
  );
  await page.screenshot({ path: capture("push-1440") });
  await openReview(page);
  await page.getByRole("tab", { name: "Evidence report" }).click();
  await expectAccessible(page);
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export report JSON" }).click();
  const reportFile = await downloadEvent;
  await reportFile.saveAs(".qa/evidence-report.json");
  const report = JSON.parse(await readFile(".qa/evidence-report.json", "utf8"));
  expect(report.kind).toBe("signalproof-report");
  expect(report.comparison.before.result.errorCount).toBe(3);
  await page.getByRole("button", { name: "Copy summary" }).click();
  if (browserName === "chromium")
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      report.snapshot.id,
    );
  await page.evaluate(() => {
    window.print = () => {
      window.dispatchEvent(new Event("beforeprint"));
      window.dispatchEvent(new Event("afterprint"));
    };
  });
  await page.getByRole("button", { name: "Print / Save as PDF" }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar")).toBeHidden();
  expect(
    await page
      .locator(".evidence-report")
      .evaluate((element) => getComputedStyle(element).backgroundColor),
  ).toBe("rgb(255, 255, 255)");
  await expect(
    page.locator(".evidence-report details:not([open])"),
  ).toHaveCount(0);
  await page.screenshot({ path: capture("print-light") });
  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await page.locator(".evidence-report").scrollIntoViewIfNeeded();
  await page.screenshot({ path: capture("report-1440") });
  expect(errors).toEqual([]);
});
