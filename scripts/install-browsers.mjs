import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { mkdirSync } from "node:fs";
const temporaryDirectory = resolve(".qa/browser-temp");
mkdirSync(temporaryDirectory, { recursive: true });
const directory = resolve(
  process.env.PLAYWRIGHT_BROWSERS_PATH ?? ".playwright-browsers",
);
if (process.platform === "win32" && /^c:/i.test(directory))
  throw new Error(
    "Set PLAYWRIGHT_BROWSERS_PATH to a D: drive directory before downloading browser engines.",
  );
console.log(
  `Installing only Firefox and WebKit to ${directory}. Approximately 190 MiB download; no Chromium download.`,
);
const result = spawnSync(
  process.execPath,
  [
    resolve("node_modules/@playwright/test/cli.js"),
    "install",
    "firefox",
    "webkit",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      TMP: temporaryDirectory,
      TEMP: temporaryDirectory,
      TMPDIR: temporaryDirectory,
      PLAYWRIGHT_BROWSERS_PATH: directory,
    },
  },
);
process.exit(result.status ?? 1);
