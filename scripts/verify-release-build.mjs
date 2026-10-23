import { spawnSync } from "node:child_process";
import { readdir, readFile, lstat, mkdir, writeFile } from "node:fs/promises";
import { resolve, join, relative } from "node:path";
import { createHash } from "node:crypto";

async function manifest(directory = resolve("dist")) {
  const entries = {};
  async function visit(folder) {
    for (const name of (await readdir(folder)).sort()) {
      const path = join(folder, name);
      const stat = await lstat(path);
      if (stat.isSymbolicLink()) throw new Error("Release output contains a symbolic link");
      if (stat.isDirectory()) { await visit(path); continue; }
      const key = relative(directory, path).replaceAll("\\", "/");
      if (!/\.(?:html|js|css|svg|txt)$/.test(key)) throw new Error(`Unexpected release file type: ${key}`);
      const body = await readFile(path);
      const text = body.toString("utf8");
      if (/[A-Z]:[\\/](?:Users|Projects)[\\/]|https?:\/\/(?:localhost|127\.0\.0\.1)|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:github_pat_|ghp_|sk-proj-)[A-Za-z0-9_]{20,}/i.test(text)) throw new Error(`Release content requires review: ${key}`);
      entries[key] = createHash("sha256").update(body).digest("hex");
    }
  }
  await visit(directory);
  const html = await readFile(join(directory, "index.html"), "utf8");
  for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const asset = new URL(url, "https://release.invalid/SignalProof/");
    if (asset.origin !== "https://release.invalid" || !asset.pathname.startsWith("/SignalProof/")) throw new Error("Index contains an asset outside the Pages subpath");
    if (!entries[asset.pathname.slice("/SignalProof/".length)]) throw new Error("Index references a missing file");
  }
  if (!entries["third-party-notices.txt"]) throw new Error("Shipped dependency notices are missing");
  return entries;
}
function build() {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, "run", "build:pages"], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
build();
const first = await manifest();
build();
const second = await manifest();
if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error("Repeated Pages builds produced different file names or bytes");
await mkdir(".qa", { recursive: true });
await writeFile(".qa/pages-build-hashes.json", JSON.stringify(second, null, 2));
console.log(`Verified ${Object.keys(second).length} static files: identical SHA-256 hashes across two builds, valid subpath references, no local runtime URL or detected credential/path patterns.`);
