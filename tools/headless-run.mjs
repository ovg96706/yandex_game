/**
 * Смоук-тест «чёрного экрана» без браузера.
 *
 * Поднимает реальный index.html в jsdom, выполняет реальный vendor/phaser.min.js
 * (CANVAS-рендер, WebGL в jsdom нет) и прогоняет реальные ES-модули игры внутри
 * окна через мини-загрузчик ESM. Дальше:
 *   1. ждёт window.load → создание Phaser.Game и регистрацию всех сцен;
 *   2. крутит игровой цикл до меню;
 *   3. по очереди создаёт каждую сцену (create() + несколько кадров);
 *   4. в GameScene и EndlessScene запускает волну и крутит бой.
 *
 * Любая ошибка (исключение в сцене, дубль ключа сцены, падение цикла) валит
 * процесс с кодом 1 — ровно такие ошибки в браузере выглядят как чёрный экран.
 *
 * Нужен jsdom (dev-зависимость, в архив Яндекс Игр не попадает):
 *   npm install --no-save jsdom && npm run smoke
 */
import { readFileSync } from "node:fs";
import { resolve as presolve, dirname as pdirname } from "node:path";
import { fileURLToPath } from "node:url";

let JSDOM, VirtualConsole;
try {
  ({ JSDOM, VirtualConsole } = await import("jsdom"));
} catch (e) {
  console.error("jsdom не установлен. Выполните: npm install --no-save jsdom");
  process.exit(2);
}

const HERE = pdirname(fileURLToPath(import.meta.url));
const ROOT = presolve(HERE, "..");
const GAME = presolve(ROOT, "dungeon_keeper_mvp");
const BOOT_SECONDS = Number(process.env.BOOT_SECONDS || 3);
const WAVE_FRAMES = Number(process.env.WAVE_FRAMES || 900);

const errors = [];
const note = (kind, message, stack) => errors.push({ kind, message: String(message ?? ""), stack: String(stack ?? "") });
const cut = (v, n = 700) => { const s = String(v ?? ""); return s.length > n ? `${s.slice(0, n)} …[+${s.length - n}]` : s; };

// Phaser бросает и асинхронно (колбэки загрузки текстур). Без этих обработчиков
// node печатает всю минифицированную простыню движка и маскирует причину.
const crash = (label) => (err) => {
  console.error(`\nFAIL (${label}): ${err?.message || err}`);
  const frames = String(err?.stack || "").split("\n")
    .filter((l) => !l.includes("phaser.min.js") && !l.startsWith("<anonymous_script>"))
    .slice(0, 10).join("\n");
  if (frames) console.error(frames);
  process.exit(1);
};
process.on("uncaughtException", crash("uncaughtException"));
process.on("unhandledRejection", crash("unhandledRejection"));

const vc = new VirtualConsole();
vc.on("jsdomError", (e) => {
  // jsdom не реализует window.focus()/alert() и т.п. — это не ошибки игры.
  if (/Not implemented/.test(e.message)) { console.log("[jsdom]", e.message.split("\n")[0]); return; }
  note("jsdomError", e.message, e.stack?.split("\n").slice(0, 10).join("\n"));
});
vc.on("error", (...a) => note("console.error", a.map(String).join(" ")));
vc.on("warn", (...a) => console.log("[warn]", ...a.map(String)));
vc.on("log", (...a) => console.log("[log]", ...a.map(String)));
vc.on("info", (...a) => console.log("[info]", ...a.map(String)));

const html = readFileSync(`${GAME}/index.html`, "utf8")
  .replace('<script type="module" src="./js/main.js"></script>', "")
  .replace('<script src="/sdk.js"></script>', "");

const dom = new JSDOM(html, { url: "http://localhost:3000/", runScripts: "outside-only", pretendToBeVisual: true, virtualConsole: vc });
const { window } = dom;

// ============================ браузерные заглушки ============================
const ctxStub = () => new Proxy({ canvas: { width: 1, height: 1 } }, {
  get: (t, k) => {
    if (k in t) return t[k];
    if (k === "measureText") return () => ({ width: 8, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
    if (k === "getImageData") return () => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 });
    if (k === "createLinearGradient" || k === "createRadialGradient" || k === "createPattern") return () => ({ addColorStop() {} });
    return () => {};
  },
  set: (t, k, v) => { t[k] = v; return true; },
});
window.HTMLCanvasElement.prototype.getContext = function (type) {
  if (type === "2d") { this.__ctx ||= ctxStub(); return this.__ctx; }
  return null; // WebGL недоступен → Phaser уходит в CANVAS
};
window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,";

// jsdom без resources:"usable" не грузит data-URL → TextureManager не даёт READY,
// а без READY Phaser вообще не регистрирует сцены.
window.Image = class {
  constructor() { this.width = 4; this.height = 4; this.complete = false; }
  set src(v) { this._src = v; setTimeout(() => { this.complete = true; this.onload?.(); }, 0); }
  get src() { return this._src; }
  addEventListener(t, cb) { if (t === "load") this.onload = cb; if (t === "error") this.onerror = cb; }
  removeEventListener() {}
};

const param = () => ({
  value: 0,
  setValueAtTime() { return this; }, linearRampToValueAtTime() { return this; },
  exponentialRampToValueAtTime() { return this; }, setTargetAtTime() { return this; },
  cancelScheduledValues() { return this; },
});
class FakeAudioContext {
  constructor() { this.state = "running"; this.currentTime = 0; this.sampleRate = 44100; this.destination = {}; this.listener = {}; }
  createGain() { return { gain: param(), connect: () => {}, disconnect: () => {} }; }
  createOscillator() { return { frequency: param(), detune: param(), type: "", connect: () => {}, start() {}, stop() {}, disconnect: () => {}, onended: null }; }
  createBufferSource() { return { buffer: null, connect: () => {}, start() {}, stop() {}, disconnect: () => {}, playbackRate: param(), loop: false, onended: null }; }
  createBuffer(c, l) { return { length: l, numberOfChannels: c, duration: l / 44100, getChannelData: () => new Float32Array(l) }; }
  createBiquadFilter() { return { frequency: param(), Q: param(), gain: param(), type: "", connect: () => {}, disconnect: () => {} }; }
  createDynamicsCompressor() { return { threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), connect: () => {}, disconnect: () => {} }; }
  createStereoPanner() { return { pan: param(), connect: () => {}, disconnect: () => {} }; }
  createWaveShaper() { return { curve: null, oversample: "", connect: () => {}, disconnect: () => {} }; }
  createPeriodicWave() { return {}; }
  resume() { return Promise.resolve(); } suspend() { return Promise.resolve(); } close() { return Promise.resolve(); }
  decodeAudioData() { return Promise.resolve(this.createBuffer(1, 1024)); }
}
window.AudioContext = FakeAudioContext;
window.webkitAudioContext = FakeAudioContext;
window.navigator.vibrate = () => true;
window.confirm = () => false;
window.alert = () => {};
window.focus = () => {};
window.blur = () => {};

// ============================ Phaser + SDK-заглушка ============================
// jsdom не знает CanvasRenderingContext2D → Phaser считает canvas-режим недоступным
// и бросает «Cannot create Canvas context, aborting.» ещё до создания игры.
window.CanvasRenderingContext2D = function CanvasRenderingContext2D() {};
window.FORCE_CANVAS = true;
window.eval(readFileSync(`${GAME}/vendor/phaser.min.js`, "utf8"));
window.eval(readFileSync(presolve(HERE, "local-sdk-stub.js"), "utf8"));
const Phaser = window.Phaser;
if (!Phaser) { console.error("Phaser не загрузился"); process.exit(1); }

// ============================ мини-загрузчик ESM ============================
// Игровые модули должны выполняться ВНУТРИ окна jsdom (иначе Phaser/Game/DOM — разные
// миры). import/export переписываются в вызовы замыканий, спецификаторы — в пути ФС.
const importRe = /^import\s+(?:([\w$]+)\s*,\s*)?(?:\{([^}]*)\}\s*)?(?:([\w$]+)\s*)?from\s*["']([^"']+)["'];?\s*$|^import\s*["']([^"']+)["'];?\s*$/gm;

function transformSource(code) {
  let c = code.replace(/^\uFEFF/, "");
  const exported = [];
  c = c.replace(/^export\s+default\s+/gm, () => { exported.push(["default", "__default"]); return "__default = "; });
  c = c.replace(/^export\s*\{([^}]*)\}\s*;?\s*$/gm, (_, names) => {
    for (const n of names.split(",")) {
      const t = n.trim(); if (!t) continue;
      const [orig, alias] = t.split(/\s+as\s+/).map((x) => x.trim());
      exported.push([alias || orig, orig]);
    }
    return "";
  });
  c = c.replace(/^export\s+(?:async\s+)?(const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm,
    (_, kind, name) => { exported.push([name, name]); return `${kind} ${name}`; });
  return { code: c, exported };
}

const registry = new Map();

function loadModule(file) {
  if (registry.has(file)) {
    const cached = registry.get(file);
    if (cached.state === "loading") throw new Error(`circular import: ${file}`);
    return cached.exports;
  }
  const entry = { state: "loading", exports: {}, file };
  registry.set(file, entry);

  const { code, exported } = transformSource(readFileSync(file, "utf8"));
  const deps = [];
  const body = code.replace(importRe, (_, def1, named, def2, spec, bare) => {
    const depFile = presolve(pdirname(file), spec || bare);
    const idx = deps.length; deps.push(depFile);
    const bindings = [];
    if (def1) bindings.push([def1, "default"]);
    if (def2) bindings.push([def2, "default"]);
    if (named) for (const n of named.split(",")) {
      const t = n.trim(); if (!t) continue;
      const [orig, alias] = t.split(/\s+as\s+/).map((x) => x.trim());
      bindings.push([alias || orig, orig]);
    }
    return bindings.map(([local, orig]) => `var ${local} = __imp(${idx}).${orig};`).join("\n");
  });

  const epilogue = exported
    .map(([alias, local]) => `__exp(${JSON.stringify(alias)}, typeof ${local} !== "undefined" ? ${local} : undefined);`)
    .join("\n");
  const factory = window.eval(`(function (__imp, __exp) {\n${body}\n${epilogue}\n})`);

  try {
    factory((i) => loadModule(deps[i]), (k, v) => {
      Object.defineProperty(entry.exports, k, { get: () => v, enumerable: true, configurable: true });
    });
    entry.state = "done";
  } catch (e) {
    entry.state = "failed";
    note(`module:${file.split("/").slice(-2).join("/")}`, e.message, e.stack?.split("\n").slice(0, 8).join("\n"));
    throw e;
  }
  return entry.exports;
}

globalThis.window = window;
try {
  loadModule(`${GAME}/js/main.js`);
} catch (e) {
  console.error("main.js не загрузился:", e.message);
}

// ============================ запуск игры ============================
window.addEventListener("error", (e) => note("window.error", e.error?.message || e.message, e.error?.stack));
window.addEventListener("unhandledrejection", (e) => note("unhandledrejection", e.reason?.message || e.reason, e.reason?.stack));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let game = null;
const RealGame = Phaser.Game;
window.Phaser.Game = function (...args) { game = new RealGame(...args); return game; };
window.Phaser.Game.prototype = RealGame.prototype;

if (window.document.readyState !== "complete") await new Promise((r) => window.addEventListener("load", r, { once: true }));
if (!game) { window.dispatchEvent(new window.Event("load")); await sleep(200); }

if (!game) {
  console.error("FAIL: Phaser.Game не создан после window.load");
  process.exit(1);
}
console.log(`Phaser ${Phaser.VERSION} | game booted: ${game.isBooted}`);

const step = async (frames, ms = 2) => {
  for (let i = 0; i < frames; i++) {
    try { game.loop.step(Date.now()); } catch (e) { note("loop.step", e.message, e.stack?.split("\n").slice(0, 10).join("\n")); return false; }
    await sleep(ms);
  }
  return true;
};

// ждём, пока Boot → Preloader → Menu отработают
const t0 = Date.now();
while (Date.now() - t0 < BOOT_SECONDS * 1000) {
  await step(20, 2);
  if (game.scene.isActive("MenuScene")) break;
}
const registered = Object.keys(game.scene.keys || {});
console.log(`scenes registered: ${registered.length} | active: ${game.scene.getScenes(true).map((s) => s.scene.key).join(", ") || "—"}`);
if (!game.scene.isActive("MenuScene")) note("boot", "MenuScene не стала активной — игра осталась на экране загрузки");

// PROBE_SCENE=MenuScene — дамп геометрии всех текстов сцены (проверка наездов вёрстки).
if (process.env.PROBE_SCENE) {
  game.scene.getScenes(true).forEach((sc) => game.scene.stop(sc.scene.key));
  game.scene.start(process.env.PROBE_SCENE, { returnTo: "MenuScene" });
  await step(20);
  const sc = game.scene.getScene(process.env.PROBE_SCENE);
  const flat = [];
  const walk = (list, ox, oy) => {
    for (const o of list) {
      if (o.type === "Container") walk(o.list || [], ox + o.x, oy + o.y);
      else flat.push({ o, ox, oy });
    }
  };
  walk(sc.children.list, 0, 0);
  const items = flat
    .filter(({ o }) => o.type === "Text")
    .map(({ o, ox, oy }) => ({
      text: String(o.text).slice(0, 44).replace(/\n/g, "\\n"),
      x: Math.round(ox + o.x - o.width * o.originX), y: Math.round(oy + o.y - o.height * o.originY),
      w: Math.round(o.width), h: Math.round(o.height),
    }));
  console.log(JSON.stringify(items));
  const overlaps = [];
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
    const a = items[i], b = items[j];
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox > 4 && oy > 4) overlaps.push([a.text, b.text, ox, oy]);
  }
  console.log("OVERLAPS:", JSON.stringify(overlaps));
  process.exit(0);
}

// ---- create() каждой мета-сцены ----
const META_SCENES = ["SettingsScene", "ShopScene", "TalentsScene", "BestiaryScene", "AchievementsScene",
  "LeaderboardScene", "QuestsScene", "DailyScene", "WheelScene"];
for (const key of META_SCENES) {
  const before = errors.length;
  game.scene.getScenes(true).forEach((sc) => game.scene.stop(sc.scene.key));
  game.scene.start(key, { returnTo: "MenuScene" });
  await step(15);
  const ok = game.scene.isActive(key) && errors.length === before;
  console.log(`${ok ? "ok  " : "FAIL"} ${key}${errors.length > before ? " — " + cut(errors[errors.length - 1].message, 160) : ""}`);
}

// ---- игровые сцены + волна ----
for (const key of ["GameScene", "EndlessScene"]) {
  const before = errors.length;
  game.scene.getScenes(true).forEach((sc) => game.scene.stop(sc.scene.key));
  game.scene.start(key);
  await step(30);
  const sc = game.scene.getScene(key);
  if (!sc) { note(key, "сцена не найдена после start"); continue; }
  sc.startWave?.();
  let maxHeroes = 0;
  for (let i = 0; i < WAVE_FRAMES; i++) {
    try { game.loop.step(Date.now()); } catch (e) { note(`${key}.wave@${i}`, e.message, e.stack?.split("\n").slice(0, 12).join("\n")); break; }
    maxHeroes = Math.max(maxHeroes, sc.heroes?.length || 0);
    if (sc.gameOverState || (!sc.waveInProgress && i > 60)) break;
    await sleep(1);
  }
  const ok = errors.length === before && maxHeroes > 0;
  console.log(`${ok ? "ok  " : "FAIL"} ${key} | mode=${sc.gameMode} heroes=${maxHeroes} pieces=${sc.iterPieces?.().length ?? 0} wave=${sc.waveNo?.()} crystalHP=${sc.crystalHP}`);
}

console.log(`\n=== errors: ${errors.length} ===`);
for (const e of errors.slice(0, 20)) {
  const frames = e.stack.split("\n").filter((l) => !l.includes("phaser.min.js")).slice(0, 8).join("\n");
  console.log(`--- ${e.kind}: ${cut(e.message, 400)}${frames ? "\n" + frames : ""}`);
}
process.exit(errors.length ? 1 : 0);
