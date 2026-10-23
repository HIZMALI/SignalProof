import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { resolve, sep, extname } from "node:path";
import { pathToFileURL } from "node:url";

// Deliberately no root mount or SPA fallback: a broken /assets URL must fail.
export async function servePages(port = 4177) {
  const root = await realpath(resolve("dist"));
  const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };
  const server = createServer(async (request, response) => {
    try {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      if (!["GET", "HEAD"].includes(request.method) || !pathname.startsWith("/SignalProof/")) {
        response.writeHead(404).end(); return;
      }
      const relative = pathname.slice("/SignalProof/".length) || "index.html";
      const file = await realpath(resolve(root, relative));
      if (!file.startsWith(root + sep)) { response.writeHead(404).end(); return; }
      const body = await readFile(file);
      response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream", "Cache-Control": "no-store" });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise((accept, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", accept);
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await servePages();
  console.log("Production files mounted only at http://127.0.0.1:4177/SignalProof/");
}
