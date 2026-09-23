/**
 * Регрессия «чёрного экрана»: Phaser регистрирует сцены по ключу из
 * `new SceneClass().sys.settings.key`. Если класс-наследник вызывает
 * `super("СвойКлюч")`, а родитель объявлен как `constructor() { super("Родитель") }`,
 * аргумент наследника молча теряется (конструктор родителя вызывается без аргументов)
 * и обе сцены получают один ключ. Phaser бросает
 * «Cannot add a Scene with duplicate key» внутри колбэка загрузки текстур —
 * исключение тонет, ни одна сцена не стартует, в браузере остаётся чёрный экран.
 *
 * Стаб повторяет семантику Phaser.Class: initialize — обычная функция-конструктор,
 * поэтому super(...) честно прокидывает аргументы по цепочке.
 */
import test from "node:test";
import assert from "node:assert/strict";

globalThis.Phaser = {
  Scene: function Scene(key) { this.sys = { settings: { key: typeof key === "string" ? key : "" } }; },
  AUTO: 0,
  HEADLESS: 3,
  Scenes: { Events: { SHUTDOWN: "shutdown", START: "start" } },
  Math: { Between: (a) => a, Clamp: (v) => v },
  Scale: { FIT: 0, CENTER_BOTH: 0 },
  Game: class Game {},
};
globalThis.Phaser.Scene.prototype = { sys: null };
globalThis.window = globalThis.window || { addEventListener: () => {} };

const { BootScene } = await import("../dungeon_keeper_mvp/js/scenes/BootScene.js");
const { PreloaderScene } = await import("../dungeon_keeper_mvp/js/scenes/PreloaderScene.js");
const { MenuScene } = await import("../dungeon_keeper_mvp/js/scenes/MenuScene.js");
const { ShopScene } = await import("../dungeon_keeper_mvp/js/scenes/ShopScene.js");
const { GameScene } = await import("../dungeon_keeper_mvp/js/scenes/GameScene.js");
const { EndlessScene } = await import("../dungeon_keeper_mvp/js/scenes/EndlessScene.js");
const { DailyScene } = await import("../dungeon_keeper_mvp/js/scenes/DailyScene.js");
const { WheelScene } = await import("../dungeon_keeper_mvp/js/scenes/WheelScene.js");
const { QuestsScene } = await import("../dungeon_keeper_mvp/js/scenes/QuestsScene.js");
const { TalentsScene } = await import("../dungeon_keeper_mvp/js/scenes/TalentsScene.js");
const { BestiaryScene } = await import("../dungeon_keeper_mvp/js/scenes/BestiaryScene.js");
const { AchievementsScene } = await import("../dungeon_keeper_mvp/js/scenes/AchievementsScene.js");
const { LeaderboardScene } = await import("../dungeon_keeper_mvp/js/scenes/LeaderboardScene.js");
const { SettingsScene } = await import("../dungeon_keeper_mvp/js/scenes/SettingsScene.js");

/** Тот же порядок, что в scene: [...] конфигурации main.js. */
const SCENES = [
  BootScene, PreloaderScene, MenuScene, ShopScene, GameScene, EndlessScene,
  DailyScene, WheelScene, QuestsScene, TalentsScene, BestiaryScene,
  AchievementsScene, LeaderboardScene, SettingsScene,
];

const keyOf = (SceneClass) => new SceneClass().sys.settings.key;

test("every scene reports its own non-empty Phaser key", () => {
  for (const SceneClass of SCENES) {
    const key = keyOf(SceneClass);
    assert.ok(typeof key === "string" && key.length > 0, `${SceneClass.name} has no scene key`);
    assert.equal(key, SceneClass.name, `${SceneClass.name} is registered as "${key}"`);
  }
});

test("scene keys are unique — Phaser would abort boot on a duplicate", () => {
  const keys = SCENES.map(keyOf);
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  assert.deepEqual(dupes, [], `duplicate scene keys: ${dupes.join(", ")}`);
});

test("EndlessScene inherits GameScene without inheriting its key", () => {
  assert.ok(EndlessScene.prototype instanceof GameScene);
  assert.equal(keyOf(EndlessScene), "EndlessScene");
  assert.equal(keyOf(GameScene), "GameScene");
  // Конструктор GameScene обязан принимать ключ, иначе super("EndlessScene") теряет аргумент.
  assert.equal(new GameScene("CustomKey").sys.settings.key, "CustomKey",
    "GameScene constructor must accept a scene key argument");
});
