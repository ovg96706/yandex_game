/**
 * Проверка всех игровых модулей реальным ESM-импортом (node --check не парсит
 * модули как ESM и пропускает часть синтаксических ошибок).
 * Phaser/окно застаблены — проверяется уровень модулей, не рантайм сцены.
 */
import { readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

globalThis.Phaser = {
  Scene: class Scene { constructor(key) { this.sceneKey = key; } },
  AUTO: 0,
  Scenes: { Events: { SHUTDOWN: "shutdown" } },
  Math: { Between: () => 0, Clamp: (v) => v },
  Scale: { FIT: 0, CENTER_BOTH: 0 },
  Game: class Game {},
};
globalThis.window = globalThis.window || { addEventListener: () => {} };
// main.js на верхнем уровне читает document.readyState и вешает обработчики —
// даём минимальный DOM-стаб, чтобы модуль оставался импортируемым вне браузера.
globalThis.document = globalThis.document || {
  readyState: "loading", // не запускаем Phaser.Game на импорте модуля
  hidden: false,
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: () => null,
};

const jsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "dungeon_keeper_mvp", "js");
const files = [];
for (const name of readdirSync(jsDir)) if (name.endsWith(".js")) files.push(join(jsDir, name));
const scenesDir = join(jsDir, "scenes");
for (const name of readdirSync(scenesDir)) if (name.endsWith(".js")) files.push(join(scenesDir, name));

let failed = 0;
for (const f of files) {
  const url = new URL(`file://${f}`).href;
  try {
    await import(url);
    console.log("OK  ", f.split("/").slice(-2).join("/"));
  } catch (e) {
    failed++;
    console.log("FAIL", f.split("/").slice(-2).join("/"), "->", e.message);
  }
}
if (failed) {
  console.error(`${failed} module(s) failed to import`);
  process.exit(1);
}
console.log(`All ${files.length} modules imported successfully (ESM parse + module side effects).`);
