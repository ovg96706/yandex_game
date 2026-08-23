/**
 * Headless-прогон логики доски GameScene без браузера:
 * комбо-слоты «ловушка+монстр», фигуры 2×2 (дракон), мёрдж, HP монстров, щит паладина.
 * Phaser застаблен минимально — проверяется игровая логика, не рендер.
 */
import test from "node:test";
import assert from "node:assert/strict";

const mkObj = (extra = {}) => {
  const o = { x: 0, y: 0, width: 0, active: true, ...extra };
  const chain = () => o;
  Object.assign(o, {
    setOrigin: chain, setScale: chain, setDepth: chain, setSize: chain, setPosition: chain,
    setAlpha: chain, setVisible: chain, setTint: chain, clearTint: chain, setFillStyle: chain,
    setStrokeStyle: chain, setText: chain, setColor: chain, setFontSize: chain, setInteractive: chain,
    on: chain, destroy() { o.active = false; },
  });
  return o;
};
const fakeGraphics = new Proxy({}, { get: (t, k) => (k === "destroy" ? () => {} : () => fakeGraphics) });

globalThis.Phaser = {
  Scene: class Scene { constructor() {} },
  AUTO: 0,
  Scenes: { Events: { SHUTDOWN: "shutdown" } },
  Math: { Between: (a, b) => a, Clamp: (v, a, b) => Math.max(a, Math.min(b, v)) },
  Scale: { FIT: 0, CENTER_BOTH: 0 },
  Game: class Game {},
};
globalThis.window = globalThis.window || { addEventListener: () => {} };

const { GameScene } = await import("../dungeon_keeper_mvp/js/scenes/GameScene.js");

function makeScene() {
  const scene = Object.create(GameScene.prototype);
  scene.gridItems = new Map();
  scene.heroes = [];
  scene.textPool = null;
  scene.add = {
    container: () => mkObj(), text: () => mkObj(), rectangle: () => mkObj(),
    circle: () => mkObj(), sprite: () => mkObj(), graphics: () => fakeGraphics,
  };
  scene.make = { graphics: () => fakeGraphics };
  scene.tweens = { add: () => {} };
  scene.time = { delayedCall: () => {} };
  scene.cameras = { main: { shake: () => {} } };
  scene.refreshUI = () => {};
  scene._precomputeGrid();
  return scene;
}

test("board: trap+monster combo shares a cell, same-kind duplicate is rejected", () => {
  const scene = makeScene();
  scene.spawnBoardPiece({ row: 0, col: 0, type: "spikes", level: 1 }, false);
  scene.spawnBoardPiece({ row: 0, col: 0, type: "slime", level: 1 }, false);
  assert.equal(scene.iterPieces().length, 2);
  const entry = scene.cellEntry(0, 0);
  assert.ok(entry.trap && entry.monster);
  scene.spawnBoardPiece({ row: 0, col: 0, type: "fire_tile", level: 1 }, false);
  assert.equal(scene.iterPieces().length, 2);
  assert.equal(entry.trap.type, "spikes");
});

test("board: dragon occupies a 2x2 block via one piece and cannot fit outside the grid", () => {
  const scene = makeScene();
  scene.spawnBoardPiece({ row: 3, col: 3, type: "dragon", level: 1 }, false);
  const dragon = scene.cellEntry(3, 3).monster;
  assert.ok(dragon);
  assert.equal(scene.iterPieces().length, 1);
  assert.strictEqual(scene.cellEntry(4, 4).monster, dragon);
  assert.strictEqual(scene.cellEntry(3, 4).monster, dragon);
  assert.strictEqual(scene.cellEntry(4, 3).monster, dragon);
  assert.equal(dragon.hp, 320);
  const pos = scene.piecePos(dragon);
  assert.equal(pos.x, scene.cellCenter(3, 3).x + 32);
  assert.equal(pos.y, scene.cellCenter(3, 3).y + 32);
  scene.spawnBoardPiece({ row: 7, col: 4, type: "dragon", level: 1 }, false);
  assert.equal(scene.iterPieces().length, 1); // за краем — не встаёт
});

test("board: movePiece respects 2x2 footprint and frees old slots", () => {
  const scene = makeScene();
  scene.spawnBoardPiece({ row: 3, col: 3, type: "dragon", level: 1 }, false);
  scene.spawnBoardPiece({ row: 0, col: 0, type: "slime", level: 1 }, false);
  const dragon = scene.cellEntry(3, 3).monster;
  scene.movePiece(dragon, 0, 0, { x: 0, y: 0 });
  assert.equal(dragon.row, 3); // занятого монстром якоря — ход отклонён
  scene.movePiece(dragon, 4, 1, { x: 0, y: 0 });
  assert.deepEqual([dragon.row, dragon.col], [4, 1]);
  assert.equal(scene.cellEntry(3, 3), null);
  assert.strictEqual(scene.cellEntry(5, 2).monster, dragon);
  // ловушка свободно встаёт под клетку дракона (свой слот)
  scene.spawnBoardPiece({ row: 4, col: 1, type: "spikes", level: 1 }, false);
  assert.ok(scene.cellEntry(4, 1).trap);
});

test("board: removePiece on a dragon clears all four slots only", () => {
  const scene = makeScene();
  scene.spawnBoardPiece({ row: 4, col: 1, type: "dragon", level: 1 }, false);
  scene.spawnBoardPiece({ row: 4, col: 1, type: "spikes", level: 1 }, false);
  const dragon = scene.cellEntry(4, 1).monster;
  scene.removePiece(dragon);
  assert.equal(scene.cellEntry(4, 1).monster, null);
  assert.equal(scene.cellEntry(5, 2), null);
  assert.ok(scene.cellEntry(4, 1).trap); // ловушка того же слота не трогается
});

test("combat: merge upgrades level and monster HP scale up; kills remove the piece", () => {
  const scene = makeScene();
  scene.spawnBoardPiece({ row: 0, col: 0, type: "slime", level: 1 }, false);
  scene.spawnBoardPiece({ row: 2, col: 0, type: "slime", level: 1 }, false);
  const a = scene.cellEntry(2, 0).monster, b = scene.cellEntry(0, 0).monster;
  scene.tryMerge(a, b, { x: 0, y: 0 });
  const merged = scene.cellEntry(0, 0).monster;
  assert.equal(scene.iterPieces().filter((p) => p.type === "slime").length, 1);
  assert.equal(merged.level, 2);
  assert.equal(merged.hp, 180);
  scene.damageMonster(merged, 100);
  assert.equal(merged.hp, 80);
  scene.damageMonster(merged, 200);
  assert.equal(scene.cellEntry(0, 0), null); // последняя фигура клетки снята — запись удалена
  scene.damageMonster(merged, 999); // повторное добивание не падает
});

test("combat: paladin shield blocks only trap effects, never monster attacks", () => {
  const scene = makeScene();
  const paladin = {
    shieldHits: 3, hp: 1000, maxHp: 1000, dead: false,
    container: mkObj(), graphic: mkObj(), isBoss: true,
    typeDef: { id: "paladin", goldReward: 1, soulReward: 1 },
  };
  scene.heroes.push(paladin);
  assert.equal(scene.damageHero(paladin, 100, false, "trap"), false);
  assert.equal(paladin.hp, 1000);
  assert.equal(paladin.shieldHits, 2);
  assert.equal(scene.damageHero(paladin, 100, false, "monster"), true);
  assert.equal(paladin.hp, 900);
  assert.equal(paladin.shieldHits, 2); // атака монстра не тратит заряды щита
  scene.damageHero(paladin, 1, false, "trap");
  scene.damageHero(paladin, 1, false, "trap");
  assert.equal(paladin.shieldHits, 0);
  assert.equal(scene.damageHero(paladin, 50, false, "trap"), true); // четвёртая ловушка пробивает
  assert.equal(paladin.hp, 850);
});
