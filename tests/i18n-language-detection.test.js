/**
 * П. 2.14 Требований Яндекс Игр — автоопределение языка.
 * https://yandex.ru/dev/games/doc/ru/requirements/2/14
 *
 * Проверяем без браузера:
 *  - environment.i18n.lang читается сразу после YaGames.init(), до getPlayer/getLeaderboards;
 *  - резервный набор языков совпадает с документацией «Языки и домены»;
 *  - BootScene применяет язык платформы ДО загрузки сейва и до PreloaderScene/ready();
 *  - явный выбор игрока в настройках перекрывает язык платформы (документация это допускает);
 *  - локальный лидерборд не хранит русскую подпись гостя.
 */
import test from "node:test";
import assert from "node:assert/strict";

const mkObj = () => {
  const o = { text: "" };
  const chain = () => o;
  Object.assign(o, {
    setOrigin: chain, setDepth: chain, setAlpha: chain, setStrokeStyle: chain, setFillStyle: chain,
    setText(v) { o.text = v; return o; },
  });
  return o;
};

globalThis.Phaser = {
  Scene: class Scene { constructor() {} },
  AUTO: 0,
  Scenes: { Events: { SHUTDOWN: "shutdown" } },
  Math: { Between: (a) => a, Clamp: (v, a, b) => Math.max(a, Math.min(b, v)) },
  Scale: { FIT: 0, CENTER_BOTH: 0 },
  Game: class Game {},
};
globalThis.window = globalThis.window || { addEventListener: () => {} };

function memoryStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    _store: store,
  };
}

const { i18n, resolveLanguage, LANG_ALIASES, SUPPORTED_LANGUAGES } = await import("../dungeon_keeper_mvp/js/i18n.js");
const { SDK } = await import("../dungeon_keeper_mvp/js/sdk.js");
const { saveManager } = await import("../dungeon_keeper_mvp/js/saveManager.js");
const { BootScene } = await import("../dungeon_keeper_mvp/js/scenes/BootScene.js");

/** Мок YaGames в духе debug-панели: фиксирует порядок обращений к SDK. */
function mockYaGames(lang, calls = []) {
  const i18nObj = {};
  Object.defineProperty(i18nObj, "lang", {
    enumerable: true,
    get() { calls.push("i18n.lang"); return lang; },
  });
  const ysdk = {
    environment: { app: { id: "test" }, i18n: i18nObj },
    features: { LoadingAPI: { ready: () => calls.push("ready") }, GameplayAPI: { start() {}, stop() {} } },
    getPlayer: async () => { calls.push("getPlayer"); throw new Error("no auth"); },
    getLeaderboards: async () => { calls.push("getLeaderboards"); throw new Error("no boards"); },
  };
  return { YaGames: { init: async () => { calls.push("init"); return ysdk; } }, calls, ysdk };
}

function resetSdk() {
  SDK.ysdk = null; SDK.player = null; SDK.leaderboards = null; SDK.lang = null;
  SDK.status = "idle"; SDK._initPromise = null; SDK._eventsBound = false;
}

// В Node 22+ globalThis.navigator — геттер без сеттера, поэтому подменяем через defineProperty.
function setNavigator(value) {
  if (value === undefined) delete globalThis.navigator;
  else Object.defineProperty(globalThis, "navigator", { value, configurable: true, writable: true });
}

const snapshot = () => ({
  window: globalThis.window, localStorage: globalThis.localStorage,
  navigatorDesc: Object.getOwnPropertyDescriptor(globalThis, "navigator"),
  document: globalThis.document, lang: i18n.getLanguage(),
});
function restore(s) {
  globalThis.window = s.window; globalThis.localStorage = s.localStorage;
  if (s.navigatorDesc) Object.defineProperty(globalThis, "navigator", s.navigatorDesc); else delete globalThis.navigator;
  if (s.document === undefined) delete globalThis.document; else globalThis.document = s.document;
  i18n.setLanguage(s.lang, false);
  resetSdk();
}

// ------------------------------------------------------------------
// Резервный набор языков (Языки и домены → «Наборы языков»)
// ------------------------------------------------------------------

test("2.14: supported languages map to themselves, case- and region-insensitive", () => {
  for (const { id } of SUPPORTED_LANGUAGES) {
    assert.equal(resolveLanguage(id), id);
    assert.equal(resolveLanguage(id.toUpperCase()), id);
  }
  assert.equal(resolveLanguage("en-US"), "en");
  assert.equal(resolveLanguage("tr_TR"), "tr");
  assert.equal(resolveLanguage("ru-RU"), "ru");
});

test("2.14: Yandex fallback set — ru for be/kk/uk/uz, en for every other catalog language", () => {
  for (const code of ["be", "kk", "uk", "uz"]) assert.equal(resolveLanguage(code), "ru", code);
  // Полный список языков каталога Яндекс Игр (ISO 639-1) без ru/tr/en и без группы «→ ru».
  const restOfCatalog = [
    "ar", "az", "bg", "ca", "cs", "de", "es", "fa", "fr", "he", "hi", "hu", "hy", "id",
    "it", "ja", "ka", "nl", "pl", "pt", "ro", "sk", "sr", "th", "tk", "vi", "zh",
  ];
  for (const code of restOfCatalog) assert.equal(resolveLanguage(code), "en", code);
  assert.equal(resolveLanguage("xx"), "en", "unknown code falls back to en");
  for (const [from, to] of Object.entries(LANG_ALIASES)) assert.ok(i18n.locales[to], `${from} → ${to} must be a built-in locale`);
});

test("2.14: empty language from platform falls back to ru, never throws", () => {
  assert.equal(resolveLanguage(undefined), "ru");
  assert.equal(resolveLanguage(null), "ru");
  assert.equal(resolveLanguage(""), "ru");
});

// ------------------------------------------------------------------
// SDK-обёртка
// ------------------------------------------------------------------

test("2.14: environment.i18n.lang is read right after YaGames.init(), before player/leaderboards", async () => {
  const s = snapshot();
  try {
    const mock = mockYaGames("tr");
    globalThis.window = { YaGames: mock.YaGames, addEventListener: () => {} };
    resetSdk();

    assert.equal(await SDK.init(), true);
    assert.equal(SDK.getLanguage(), "tr");
    assert.deepEqual(mock.calls.slice(0, 2), ["init", "i18n.lang"], "lang must be the first thing read after init");
    assert.ok(mock.calls.indexOf("i18n.lang") < mock.calls.indexOf("getPlayer"));
    assert.ok(mock.calls.indexOf("i18n.lang") < mock.calls.indexOf("getLeaderboards"));
  } finally { restore(s); }
});

test("2.14: platform language is still read when the SDK object has no environment (old mocks)", async () => {
  const s = snapshot();
  try {
    globalThis.window = { YaGames: { init: async () => ({ features: {}, getPlayer: async () => null, getLeaderboards: async () => null }) }, addEventListener: () => {} };
    resetSdk();
    assert.equal(await SDK.init(), true);
    assert.equal(SDK.lang, null);
    assert.equal(typeof SDK.getLanguage(), "string");
  } finally { restore(s); }
});

test("outside Yandex: browser language is used, then ru", () => {
  const s = snapshot();
  try {
    resetSdk();
    setNavigator({ language: "tr-TR" });
    assert.equal(SDK.getLanguage(), "tr-TR");
    assert.equal(resolveLanguage(SDK.getLanguage()), "tr");
    setNavigator({ language: "" });
    assert.equal(SDK.getLanguage(), "ru");
    setNavigator(undefined);
    assert.equal(SDK.getLanguage(), "ru");
  } finally { restore(s); }
});

// ------------------------------------------------------------------
// BootScene — «во время запуска, а не в процессе игры»
// ------------------------------------------------------------------

function makeBootScene() {
  const scene = Object.create(BootScene.prototype);
  const texts = [];
  scene.cameras = { main: { setBackgroundColor() {} } };
  scene.add = { text: (_x, _y, str) => { const o = mkObj(); o.text = str; texts.push(o); return o; } };
  scene.input = { once() {} };
  scene.started = [];
  scene.scene = { start: (key) => scene.started.push(key) };
  return { scene, texts };
}

test("2.14: BootScene applies the platform language before the save is loaded and before PreloaderScene", async () => {
  const s = snapshot();
  const origLoad = saveManager.load;
  try {
    const mock = mockYaGames("en");
    globalThis.window = { YaGames: mock.YaGames, addEventListener: () => {} };
    globalThis.localStorage = memoryStorage();
    globalThis.document = { documentElement: { lang: "ru" } };
    resetSdk();
    i18n.setLanguage("ru", false);

    let langWhenSaveLoaded = null;
    saveManager.load = async function () {
      langWhenSaveLoaded = i18n.getLanguage();
      return origLoad.call(this);
    };

    const { scene, texts } = makeBootScene();
    scene.create();
    assert.equal(texts[0].text, i18n.locales.ru.boot_init, "before SDK answers the default locale is shown");

    await scene.bootPromise;

    assert.equal(langWhenSaveLoaded, "en", "language must be set before the (slow) save/cloud load");
    assert.equal(i18n.getLanguage(), "en");
    assert.equal(texts[0].text, i18n.locales.en.boot_init, "loading text switches together with the language");
    assert.equal(texts[1].text, i18n.locales.en.boot_title);
    assert.equal(globalThis.document.documentElement.lang, "en");
    assert.deepEqual(scene.started, ["PreloaderScene"]);
    assert.ok(!mock.calls.includes("ready"), "LoadingAPI.ready() belongs to PreloaderScene, after the language is known");
    assert.ok(mock.calls.includes("i18n.lang"));
  } finally {
    saveManager.load = origLoad;
    restore(s);
  }
});

test("2.14: an explicit language chosen in settings overrides the platform language (allowed by the docs)", async () => {
  const s = snapshot();
  const origLoad = saveManager.load;
  try {
    const mock = mockYaGames("en");
    globalThis.window = { YaGames: mock.YaGames, addEventListener: () => {} };
    globalThis.localStorage = memoryStorage();
    resetSdk();
    i18n.setLanguage("ru", false);

    saveManager.load = async function () {
      await origLoad.call(this);
      this.data.settings.language = "tr";
      return this.data;
    };

    const { scene, texts } = makeBootScene();
    scene.create();
    await scene.bootPromise;

    assert.equal(i18n.getLanguage(), "tr");
    assert.equal(texts[0].text, i18n.locales.tr.boot_init);
    assert.ok(mock.calls.includes("i18n.lang"), "platform lang is still read → debug-panel indicator stays green");
  } finally {
    saveManager.load = origLoad;
    restore(s);
  }
});

test("2.14: without any saved choice the save keeps language=null so the platform decides next time too", async () => {
  const s = snapshot();
  try {
    const mock = mockYaGames("tr");
    globalThis.window = { YaGames: mock.YaGames, addEventListener: () => {} };
    globalThis.localStorage = memoryStorage();
    resetSdk();

    const { scene } = makeBootScene();
    scene.create();
    await scene.bootPromise;

    assert.equal(i18n.getLanguage(), "tr");
    assert.equal(saveManager.data.settings.language, null, "auto-detected language must not be persisted as a manual choice");
  } finally { restore(s); }
});

// ------------------------------------------------------------------
// Локальный лидерборд: подпись гостя локализуется при отрисовке
// ------------------------------------------------------------------

test("local leaderboard stores a guest number, not a Russian display name", async () => {
  const s = snapshot();
  try {
    resetSdk();
    globalThis.localStorage = memoryStorage();
    await SDK.submitScore("maxWave", 12);
    const raw = JSON.parse(globalThis.localStorage.getItem("dk_lb_maxWave"));
    assert.equal(raw.length, 1);
    assert.equal(raw[0].name, undefined);
    assert.ok(Number.isInteger(raw[0].guestNo));
    const board = await SDK.getLeaderboard("maxWave", 10);
    assert.equal(board.entries[0].name, null);
    assert.equal(board.entries[0].guestNo, raw[0].guestNo);
    assert.equal(board.player.guestNo, raw[0].guestNo);
    for (const lang of ["ru", "en", "tr"]) {
      i18n.setLanguage(lang, false);
      assert.equal(i18n.t("lb_guest_name", board.player.guestNo), i18n.locales[lang].lb_guest_name.replace("{0}", board.player.guestNo));
    }
  } finally { restore(s); }
});

test("local leaderboard migrates legacy «Хранитель 4242» entries keeping the number", async () => {
  const s = snapshot();
  try {
    resetSdk();
    globalThis.localStorage = memoryStorage();
    globalThis.localStorage.setItem("dk_guest_id", "guest_legacy");
    globalThis.localStorage.setItem("dk_guest_name", "Хранитель 4242");
    globalThis.localStorage.setItem("dk_lb_maxWave", JSON.stringify([{ uniqueID: "guest_legacy", name: "Хранитель 4242", score: 7 }]));

    const before = await SDK.getLeaderboard("maxWave", 10);
    assert.equal(before.entries[0].guestNo, 4242, "legacy name is parsed on read");

    await SDK.submitScore("maxWave", 9);
    const raw = JSON.parse(globalThis.localStorage.getItem("dk_lb_maxWave"));
    assert.deepEqual(raw, [{ uniqueID: "guest_legacy", score: 9, guestNo: 4242 }]);
  } finally { restore(s); }
});
