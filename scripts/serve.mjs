// Tiny static server for previews and checks. No dependencies.
// Usage: node scripts/serve.mjs <dir> [port] [host]
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
};

export function serve(dir, port = 0, host = "127.0.0.1") {
  const root = resolve(dir);
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://x");
      let file = normalize(join(root, decodeURIComponent(url.pathname)));
      if (file !== root && !file.startsWith(root + sep)) throw Object.assign(new Error("outside"), { code: "ENOENT" });
      if ((await stat(file)).isDirectory()) file = join(file, "index.html");
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch (e) {
      const code = e.code === "ENOENT" || e.code === "ENOTDIR" ? 404 : 500;
      res.writeHead(code, { "content-type": "text/plain; charset=utf-8" });
      res.end(code === 404 ? "Not found" : "Server error");
    }
  });
  return new Promise((ok) => server.listen(port, host, () => ok(server)));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [dir = "_site", port = "8080", host = "127.0.0.1"] = process.argv.slice(2);
  const server = await serve(dir, Number(port), host);
  console.log(`serving ${resolve(dir)} on http://${host}:${server.address().port}/`);
}
