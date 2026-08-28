/**
 * Собирает ZIP для Консоли Яндекс Игр:
 * - index.html в корне архива;
 * - без пробелов и кириллицы в именах;
 * - без sdk.js (его отдаёт платформа);
 * - без CDN-зависимостей, кроме /sdk.js.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const GAME = join(ROOT, "dungeon_keeper_mvp");
const DIST = join(ROOT, "dist");
const STAGE = join(DIST, "yandex-stage");
const ZIP = join(DIST, "dungeon-keeper-idle.zip");
const MAX_UNCOMPRESSED = 100 * 1024 * 1024;

const SKIP_NAMES = new Set([".DS_Store", "Thumbs.db"]);

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_NAMES.has(name)) continue;
    const full = join(dir, name);
    const info = statSync(full);
    if (info.isDirectory()) walk(full, acc);
    else acc.push(full);
  }
  return acc;
}

function assertSafeName(rel) {
  if (/\s/.test(rel)) throw new Error(`Пробел в имени файла: ${rel}`);
  if (/[А-Яа-яЁё]/.test(rel)) throw new Error(`Кириллица в имени файла: ${rel}`);
}

const files = walk(GAME);
let bytes = 0;
const staged = [];

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });

for (const full of files) {
  const rel = relative(GAME, full).replaceAll("\\", "/");
  if (rel === "sdk.js") {
    throw new Error("В корне архива не должно быть sdk.js — его отдаёт сервер Яндекса");
  }
  assertSafeName(rel);
  const data = readFileSync(full);
  bytes += data.length;
  const dest = join(STAGE, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, data);
  staged.push(rel);
}

const html = readFileSync(join(STAGE, "index.html"), "utf8");
if (!html.includes("./vendor/phaser.min.js")) {
  throw new Error("index.html должен подключать локальный Phaser");
}
if (/cdn\.jsdelivr|unpkg\.com|cdnjs\.cloudflare|yandex\.ru\/games\/sdk/i.test(html)) {
  throw new Error("index.html тянет внешний CDN — архив Яндекс Игр это не пропустит без CSP");
}
if (!html.includes('src="/sdk.js"')) {
  throw new Error("index.html должен подключать SDK как /sdk.js");
}
if (!staged.includes("vendor/phaser.min.js")) {
  throw new Error("В архиве нет vendor/phaser.min.js");
}
if (!staged.includes("index.html")) {
  throw new Error("В корне архива нет index.html");
}
if (bytes > MAX_UNCOMPRESSED) {
  throw new Error(`Размер ${bytes} превышает лимит 100 МБ`);
}

rmSync(ZIP, { force: true });
execFileSync("zip", ["-rq", ZIP, "."], { cwd: STAGE });
const zipSize = statSync(ZIP).size;

console.log(`Packed ${staged.length} files, uncompressed ${bytes} bytes`);
console.log(`ZIP: ${ZIP} (${zipSize} bytes)`);
console.log("Upload this archive to Yandex Games Console (index.html is at the zip root).");
