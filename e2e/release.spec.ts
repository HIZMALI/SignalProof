import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import legacy from "../src/test/fixtures/build03-evidence.json" with { type: "json" };

async function axe(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    results.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        failure: n.failureSummary,
      })),
    })),
  ).toEqual([]);
}
async function open(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).click();
}
async function download(page: Page, button: string, file: string) {
  const pending = page.waitForEvent("download");
  await open(page, button);
  const result = await pending;
  await result.saveAs(file);
  return JSON.parse(await readFile(file, "utf8"));
}

test("complete closure story uses actual checks, explicit fictional review, invalidation and portable evidence", async ({
  page,
  browserName,
  context,
}) => {
  await mkdir(".qa", { recursive: true });
  await page.goto("/");
  await expect(page.locator(".result-counts")).toContainText("3 errors");
  await expect(page.locator(".result-counts")).toContainText("2 warnings");
  await open(page, "Channel Lab");
  for (const tab of [/^SMS /, /Push notification/, /^Email /]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(page.getByRole("table")).toContainText("Source missing");
  }
  await open(page, "Announcement lab");
  await page.getByRole("button", { name: /Run validation/ }).click();
  await open(page, "Corrected closure");
  await context.setOffline(true);
  await expect(
    page.getByRole("heading", { name: "Applicable checks passed" }),
  ).toBeVisible();
  await open(page, "Channel Lab");
  for (const tab of [/^SMS /, /Push notification/, /^Email /]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(
      page.getByRole("table").getByText("Included", { exact: true }),
    ).toHaveCount(8);
  }
  await page.getByRole("tab", { name: /Push notification/ }).click();
  await page.getByLabel("Generic card preset").selectOption("roomy");
  await page.getByLabel("Generic card preset").selectOption("compact");
  await page.getByRole("tab", { name: /^SMS / }).click();
  await page.getByRole("checkbox", { name: /Stress test/ }).check();
  await expect(page.getByRole("table")).toContainText("Omitted");
  await page.getByRole("checkbox", { name: /Stress test/ }).uncheck();
  await open(page, "Announcement lab");
  await page.getByRole("button", { name: /Run validation/ }).click();
  await open(page, "Validation history");
  await open(page, "Compare versions");
  await expect(page.locator(".comparison-summary")).toContainText(
    "3 source errors resolved",
  );
  await page.getByRole("tab", { name: "Human review" }).click();
  await page
    .getByLabel("Reviewer display name", { exact: false })
    .fill("Fictional release test reviewer");
  await page
    .getByLabel("Review notes", { exact: true })
    .fill(
      "Illustrative automated test only. No real institutional source verified.",
    );
  const checks = page.getByRole("checkbox");
  for (const checkbox of await checks.all()) await checkbox.check();
  await open(page, "Complete review — self-attest");
  await expect(page.locator(".review-record summary")).toContainText(
    "self-attested",
  );
  await open(page, "Announcement lab");
  await page
    .getByLabel("Required action", { exact: false })
    .fill("Use the South Gate instead — fictional regression.");
  await expect(page.locator(".global-review-notice")).toBeVisible();
  await context.setOffline(false);
  await page.reload();
  await expect(page.locator(".global-review-notice")).toBeVisible();
  await open(page, "Review & Evidence");
  await page.getByRole("tab", { name: "Evidence report" }).click();
  const report = await download(
    page,
    "Export report JSON",
    `.qa/${browserName}-journey-report.json`,
  );
  expect(report.snapshot.draft.action).not.toContain("South Gate");
  expect(report.reviews[0].workingDraftApplicability).toBe("outdated");
  expect(report.snapshot.channels.sms.payload.body.text).toContain(
    report.snapshot.draft.action,
  );
  expect(report.limitations.join(" ")).toContain("not a safety certification");
  expect(await page.getByRole("heading").allTextContents()).not.toContain(
    "Safe to send",
  );
  await page.getByRole("tab", { name: "Backup & restore" }).click();
  const backup = await download(
    page,
    "Export evidence backup",
    `.qa/${browserName}-journey-backup.json`,
  );
  expect(backup.version).toBe(2);
  expect(backup.snapshots).toHaveLength(2);
  expect(backup.reviews[0].name).toBe("Fictional release test reviewer");
  await open(page, "Clear local evidence…");
  await open(page, "Clear evidence only");
  await page
    .getByLabel("Import evidence backup")
    .setInputFiles(`.qa/${browserName}-journey-backup.json`);
  await open(page, "Import records");
  await page.reload();
  await open(page, "Validation history");
  await expect(page.getByRole("button", { name: "Restore draft" })).toHaveCount(
    2,
  );
});

test("IANA gaps, overlap choices, interval instants and legacy evidence remain explicit in each browser", async ({
  page,
  browserName,
}) => {
  await page.addInitScript((data) => {
    localStorage.setItem("signalproof.evidence.v1", JSON.stringify(data));
  }, legacy);
  await page.goto("/");
  await open(page, "Corrected closure");
  await page.getByLabel("Time zone mode").selectOption("iana");
  await page.locator("#field-timeZone").fill("America/New_York");
  await page.locator("#field-startTime").fill("2026-03-08T02:30");
  await expect(page.locator("#time-resolution-startTime")).toContainText(
    "does not exist",
  );
  await page.locator("#field-startTime").fill("2026-11-01T01:50");
  await page.locator("#field-endTime").fill("2026-11-01T01:10");
  await expect(page.getByLabel("Start occurrence")).toHaveValue("");
  await expect(page.locator("#field-startTime")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Start occurrence").selectOption("earlier");
  await page.getByLabel("End occurrence").selectOption("later");
  await expect(
    page.getByRole("heading", { name: "Applicable checks passed" }),
  ).toBeVisible();
  await expect(page.locator("#time-resolution-startTime")).toContainText(
    "UTC-04:00",
  );
  await expect(page.locator("#time-resolution-endTime")).toContainText(
    "UTC-05:00",
  );
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  if (browserName === "chromium")
    await page
      .locator(".time-zone-controls")
      .screenshot({ path: ".qa/build04-time-zone-320.png" });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("tab", { name: "Final preview" }).click();
  await expect(page.getByLabel("Generated final announcement")).toContainText(
    "America/New_York, UTC-04:00",
  );
  await open(page, "Channel Lab");
  for (const tab of [/^SMS /, /Push notification/, /^Email /]) {
    await page.getByRole("tab", { name: tab }).click();
    await expect(
      page.getByRole("table").getByText("Included", { exact: true }),
    ).toHaveCount(8);
  }
  await open(page, "Announcement lab");
  await page.getByRole("button", { name: "Record run", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Start occurrence")).toHaveValue("earlier");
  await open(page, "Validation history");
  await expect(page.getByText(/source-1.0\/channel-1.0/)).toHaveCount(2);
  await page
    .getByRole("button", { name: "Evidence report", exact: true })
    .last()
    .click();
  await expect(page.locator(".report-time-interpretation")).toContainText(
    "Legacy recorded evidence",
  );
  await page.getByRole("tab", { name: "Backup & restore" }).click();
  const backup = await download(
    page,
    "Export evidence backup",
    `.qa/${browserName}-migration-backup.json`,
  );
  expect(backup.snapshots).toHaveLength(3);
  expect(backup.snapshots[2]).toEqual(legacy.snapshots[1]);
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("signalproof.evidence.v1")!).snapshots,
    ),
  ).toEqual(legacy.snapshots);
});

test("keyboard, dialogs, status associations, all major axe states, hash navigation and 200 percent reflow", async ({
  page,
  browserName,
}) => {
  await page.goto("/");
  const initialUrl = page.url();
  await page.getByRole("link", { name: "Skip to content" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  expect(page.url()).toBe(initialUrl);
  await page
    .getByRole("button", { name: "8 passed checks", exact: true })
    .click();
  expect(
    await page
      .locator(".passed-list")
      .evaluate((element) => element.scrollHeight <= element.clientHeight),
  ).toBe(true);
  await axe(page);
  await expect(page.locator("#field-action")).toHaveAttribute(
    "aria-describedby",
    /error-action/,
  );
  await page
    .getByRole("link", { name: "Inspect current validation results" })
    .click();
  await expect(page.locator("#validation-results")).toBeFocused();
  await page.getByRole("tab", { name: "Announcement editor" }).focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Final preview" })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(
    page.getByRole("tab", { name: "Announcement editor" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Help and limitations" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await axe(page);
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => !!document.activeElement?.closest("dialog")),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Help and limitations" }),
  ).toBeFocused();
  await open(page, "Channel Lab");
  await page.reload();
  await expect(page.getByRole("tab", { name: /^SMS / })).toBeVisible();
  await open(page, "Rulebook");
  await axe(page);
  await page.goBack();
  await expect(page.getByRole("tab", { name: /^SMS / })).toBeVisible();
  await page.goForward();
  await expect(
    page.getByRole("heading", { name: "Know what gets checked." }),
  ).toBeVisible();
  await open(page, "Validation history");
  await axe(page);
  await open(page, "Review & Evidence");
  await axe(page);
  await open(page, "Create two demo snapshots");
  await axe(page);
  await page.getByRole("tab", { name: "Human review" }).click();
  await axe(page);
  await page.getByRole("tab", { name: "Evidence report" }).click();
  await axe(page);
  await page.getByRole("tab", { name: "Backup & restore" }).click();
  await open(page, "Clear local evidence…");
  await axe(page);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Clear local evidence…" }),
  ).toBeFocused();
  // At 200% browser zoom a 1440 px content area has a 720 CSS-pixel layout viewport.
  // CSS zoom is not substituted: it does not update media queries like browser zoom does.
  await page.setViewportSize({ width: 720, height: 900 });
  for (const view of [
    "Announcement lab",
    "Channel Lab",
    "Validation history",
    "Review & Evidence",
    "Rulebook",
  ]) {
    await open(page, view);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({ path: `.qa/${browserName}-200-percent.png` });
  await open(page, "Announcement lab");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await page.evaluate(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  ).toBe(true);
});

test("near-limit production rendering remains responsive and cross-tab conflicts preserve disk evidence", async ({
  page,
  context,
  browserName,
}) => {
  const raw = await readFile(".qa/stress-evidence.json", "utf8");
  await page.addInitScript(
    (data) => localStorage.setItem("signalproof.evidence.v2", data),
    raw,
  );
  const start = Date.now();
  await page.goto("/#history");
  await expect(
    page.getByRole("button", { name: "Restore draft" }).first(),
  ).toBeVisible();
  const historyReadyMs = Date.now() - start;
  await page
    .getByRole("button", { name: "Evidence report", exact: true })
    .first()
    .click();
  await expect(page.locator(".evidence-report")).toBeVisible();
  const before = await page.evaluate(() =>
    localStorage.getItem("signalproof.evidence.v2"),
  );
  const other = await context.newPage();
  await other.goto("/");
  await other.evaluate(() => {
    const value = JSON.parse(localStorage.getItem("signalproof.evidence.v2")!);
    value.revision += 1;
    localStorage.setItem("signalproof.evidence.v2", JSON.stringify(value));
  });
  await expect(page.getByRole("alert")).toContainText("another tab");
  expect(
    await page.evaluate(() => localStorage.getItem("signalproof.evidence.v2")),
  ).not.toBe(before);
  await other.close();
  await mkdir(".qa", { recursive: true });
  await writeFile(
    `.qa/${browserName}-browser-profile.json`,
    JSON.stringify({
      historyReadyMs,
      snapshots: JSON.parse(raw).snapshots.length,
      reviews: JSON.parse(raw).reviews.length,
    }),
  );
});

test("Chromium produces an actual complete light print PDF", async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== "chromium",
    "Playwright PDF generation is Chromium-only; print media is tested in every engine.",
  );
  await page.goto("/");
  await open(page, "Review & Evidence");
  await open(page, "Create two demo snapshots");
  await page.getByRole("tab", { name: "Human review" }).click();
  await page
    .getByLabel("Reviewer display name", { exact: false })
    .fill("Fictional print test reviewer");
  await page
    .getByLabel("Review notes", { exact: true })
    .fill(
      "Print QA only. <script>untrusted text</script> stays literal; no real facts verified.",
    );
  await open(page, "Record observations");
  await page.getByRole("tab", { name: "Evidence report" }).click();
  await writeFile(
    ".qa/pdf-source.json",
    JSON.stringify(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("signalproof.evidence.v2")!),
      ),
    ),
  );
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await page.emulateMedia({ media: "print" });
  await page.pdf({
    path: ".qa/release-report.pdf",
    format: "A4",
    tagged: true,
    outline: true,
    preferCSSPageSize: true,
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<span></span>",
    footerTemplate:
      '<div style="font-size:8px;text-align:center;width:100%">SignalProof · Simulation only · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
  });
  expect(
    (await readFile(".qa/release-report.pdf")).subarray(0, 4).toString(),
  ).toBe("%PDF");
});
