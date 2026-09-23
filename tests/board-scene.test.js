/**
 * Headless-прогон логики доски GameScene без браузера:
 * один юнит на клетку, фигуры 2×2 (дракон), мёрдж, HP монстров, щит паладина,
 * шипы step-only (бьют только по своей клетке, периодически).
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
  scene.popupObjects = [];
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

test("board: one unit per cell — second piece of any kind is rejected", () => {
  const scene = makeScene();
  scene.spawnBoardPiece({ row: 0, col: 0, type: "spikes", level: 1 }, false);
  scene.spawnBoardPiece({ row: 0, col: 0, type: "slime", level: 1 }, false); // другой тип — всё равно нельзя
  assert.equal(scene.iterPieces().length, 1);
  const entry = scene.cellEntry(0, 0);
  assert.ok(entry.trap && !entry.monster);
  scene.spawnBoardPiece({ row: 0, col: 0, type: "fire_tile", level: 1 }, false); // свой тип — тоже нельзя
  assert.equal(scene.iterPieces().length, 1);
  assert.equal(entry.trap.type, "spikes");
  scene.spawnBoardPiece({ row: 0, col: 1, type: "slime", level: 1 }, false); // соседняя клетка свободна
  assert.equal(scene.iterPieces().length, 2);
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
  // клетка, занятая драконом, закрыта и для ловушки
  scene.spawnBoardPiece({ row: 4, col: 1, type: "spikes", level: 1 }, false);
  assert.equal(scene.cellEntry(4, 1).trap, null);
});

test("board: removePiece on a dragon clears all four slots", () => {
  const scene = makeScene();
  scene.spawnBoardPiece({ row: 4, col: 1, type: "dragon", level: 1 }, false);
  const dragon = scene.cellEntry(4, 1).monster;
  scene.removePiece(dragon);
  assert.equal(scene.cellEntry(4, 1), null);
  assert.equal(scene.cellEntry(5, 2), null);
  // освобождённая клетка сразу принимает новый юнит
  scene.spawnBoardPiece({ row: 4, col: 1, type: "spikes", level: 1 }, false);
  assert.ok(scene.cellEntry(4, 1).trap);
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
  assert.equal(merged.hp, 320);
  scene.damageMonster(merged, 100);
  assert.equal(merged.hp, 220);
  scene.damageMonster(merged, 200);
  assert.equal(merged.hp, 20); // слайм по спеке живучий — добиваем ещё раз
  scene.damageMonster(merged, 200);
  assert.equal(scene.cellEntry(0, 0), null); // последняя фигура клетки снята — запись удалена
  scene.damageMonster(merged, 999); // повторное добивание не падает
});

test("traps: spikes are step-only — tick damage on their own cell, silence at range", () => {
  const scene = makeScene();
  scene.spawnBoardPiece({ row: 2, col: 1, type: "spikes", level: 1 }, false);
  const mkHero = (x, y) => ({
    dead: false, disableTraps: false, isBoss: false, weaknessTool: null,
    hp: 1000, maxHp: 1000, shieldHits: 0,
    container: { x, y }, graphic: mkObj(),
    typeDef: { id: "peasant", goldReward: 4, soulReward: 2 },
  });
  const onCell = mkHero(200, 300);   // клетка (2,1): x 174..238, y 283..347
  const farAway = mkHero(400, 300);  // вне клетки — шипы не стреляют
  scene.heroes.push(onCell, farAway);

  scene.processTraps(1000, 16);
  assert.ok(onCell.hp < 1000, "герой на клетке получил урон");
  assert.equal(farAway.hp, 1000, "шип не бьёт на дистанцию");
  const hpAfterTick = onCell.hp;

  scene.processTraps(1016, 16); // кулдаун не кончился — тишина
  assert.equal(onCell.hp, hpAfterTick);

  scene.processTraps(2000, 1000); // кулдаун кончился — новый тик урона
  assert.ok(onCell.hp < hpAfterTick, "урон периодический, пока герой стоит на клетке");
});

test("board: placed units drag with any selected tool; empty cell still places", () => {
  const scene = makeScene();
  scene.spawnBoardPiece({ row: 0, col: 0, type: "spikes", level: 1 }, false);
  scene.spawnBoardPiece({ row: 2, col: 2, type: "slime", level: 1 }, false);
  const trap = scene.cellEntry(0, 0).trap;
  const monster = scene.cellEntry(2, 2).monster;
  const at = (row, col) => ({ x: 110 + col * 64 + 32, y: 155 + row * 64 + 32 });

  // Выбран монстр — а перетаскивается ловушка
  scene.selectedTool = "slime";
  scene.onPointerDown(at(0, 0));
  assert.strictEqual(scene.dragItem, trap);
  scene.onPointerUp({ x: -100, y: -100 }); // бросок вне сетки — ход отменён
  assert.equal(scene.dragItem, null);
  assert.deepEqual([trap.row, trap.col], [0, 0]);

  // Выбрана ловушка — а перетаскивается монстр, и ход применяется
  scene.selectedTool = "spikes";
  scene.onPointerDown(at(2, 2));
  assert.strictEqual(scene.dragItem, monster);
  scene.onPointerUp(at(5, 0));
  assert.deepEqual([monster.row, monster.col], [5, 0]);
  assert.equal(scene.cellEntry(2, 2), null);

  // Пустая клетка при выбранном инструменте — постановка, а не перетаскивание
  scene.onPointerDown(at(1, 1));
  assert.equal(scene.dragItem, null);
  assert.ok(scene.cellEntry(1, 1).trap);

  // Ластик по-прежнему стирает, а не тащит
  scene.selectedTool = "erase";
  scene.onPointerDown(at(1, 1));
  assert.equal(scene.dragItem, null);
  assert.equal(scene.cellEntry(1, 1), null);
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
