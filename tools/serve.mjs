/**
 * Локальный превью-сервер для dungeon_keeper_mvp.
 * - отдаёт игру с 0.0.0.0 (превью Arena / любой хост);
 * - подставляет заглушку на /sdk.js, чтобы не было 404 и не перетирался
 *   настоящий SDK при упаковке архива;
 * - не ставит X-Frame-Options (игра должна открываться в iframe).
 */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dungeon_keeper_mvp");
const STUB = resolve(dirname(fileURLToPath(import.meta.url)), "local-sdk-stub.js");
const HOST = process.env.HOST || "0.0.0.0";
const PORT = Number(process.env.PORT || 3000);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent((urlPath || "/").split("?")[0]);
  const clean = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = resolve(root, "." + (clean.startsWith("/") ? clean : `/${clean}`));
  if (!full.startsWith(root)) return null;
  return full;
}

const server = createServer(async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Access-Control-Allow-Origin", "*");

  const url = req.url || "/";
  const pathOnly = url.split("?")[0];

  try {
    if (pathOnly === "/sdk.js") {
      const body = await readFile(STUB);
      res.writeHead(200, { "Content-Type": "application/javascript; charset=utf-8" });
      res.end(body);
      return;
    }

    let filePath = safeJoin(ROOT, pathOnly === "/" ? "/index.html" : pathOnly);
    if (!filePath) {
      res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Forbidden");
      return;
    }

    let info;
    try { info = await stat(filePath); }
    catch {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }
    if (info.isDirectory()) filePath = join(filePath, "index.html");

    const type = MIME[extname(filePath).toLowerCase()] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": type });
    createReadStream(filePath).pipe(res);
  } catch (e) {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(String(e?.message || e));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Dungeon Keeper preview: http://${HOST}:${PORT}/`);
  console.log(`Game root: ${ROOT}`);
});
