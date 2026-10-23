import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
const temporaryDirectory = resolve(".qa/browser-temp");
mkdirSync(temporaryDirectory, { recursive: true });
// Keep all downloaded engines on the project drive, including on Windows.
const outcome = spawnSync(
  process.execPath,
  [
    resolve("node_modules/@playwright/test/cli.js"),
    "test",
    ...process.argv.slice(2),
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      TMP: temporaryDirectory,
      TEMP: temporaryDirectory,
      TMPDIR: temporaryDirectory,
      PLAYWRIGHT_BROWSERS_PATH:
        process.env.PLAYWRIGHT_BROWSERS_PATH ?? resolve(".playwright-browsers"),
    },
  },
);
process.exit(outcome.status ?? 1);
