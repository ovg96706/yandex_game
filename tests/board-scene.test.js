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

// ---------- Ловушки работают строго по описанию ----------
// Клетка (row, col): x = 110 + col*64 .. +64, y = 155 + row*64 .. +64; центр — +32.
const cx = (col) => 110 + col * 64 + 32;
const cy = (row) => 155 + row * 64 + 32;
const mkTrapHero = (x, y, extra = {}) => ({
  dead: false, disableTraps: false, isBoss: false, weaknessTool: null,
  hp: 100000, maxHp: 100000, shieldHits: 0, speedMultiplier: 1, slowUntil: 0,
  burnDPS: 0, burnEndTime: 0, poisonDPS: 0, poisonEndTime: 0,
  container: { x, y }, graphic: mkObj(),
  typeDef: { id: "peasant", goldReward: 4, soulReward: 2 }, ...extra,
});

for (const type of ["spikes", "fire_tile", "ice_wall"]) {
  test(`traps: ${type} hits only heroes that stepped on its tile`, () => {
    const scene = makeScene();
    scene.spawnBoardPiece({ row: 3, col: 2, type, level: 1 }, false);
    const neighbour = mkTrapHero(cx(2), cy(2));  // соседняя клетка сверху — в зоне старой «дальности»
    const side = mkTrapHero(cx(3), cy(3));       // соседняя клетка сбоку
    scene.heroes.push(neighbour, side);
    for (let i = 0; i < 20; i++) scene.processTraps(1000 + i * 200, 200);
    assert.equal(neighbour.hp, 100000, "не бьёт героя на соседней клетке");
    assert.equal(side.hp, 100000);
    assert.equal(neighbour.slowUntil, 0);
    assert.equal(neighbour.burnDPS, 0);

    const onTile = mkTrapHero(cx(2), cy(3));
    scene.heroes.push(onTile);
    scene.processTraps(6000, 16);
    assert.ok(onTile.hp < 100000, "наступившему — урон сразу");
    if (type === "ice_wall") assert.equal(onTile.slowUntil, 6000 + 3000, "лёд замедляет на 3 секунды");
    if (type === "fire_tile") assert.ok(onTile.burnDPS > 0 && onTile.burnEndTime > 6000, "огонь поджигает");
  });
}

test("traps: step traps hit every hero entering the tile, not only one per cooldown", () => {
  const scene = makeScene();
  scene.spawnBoardPiece({ row: 3, col: 2, type: "spikes", level: 1 }, false);
  const a = mkTrapHero(cx(2), cy(3)), b = mkTrapHero(cx(2) + 5, cy(3) + 5);
  scene.heroes.push(a);
  scene.processTraps(1000, 16);
  scene.heroes.push(b); // второй вошёл сразу после — кулдаун первого его не спасает
  scene.processTraps(1016, 16);
  assert.ok(a.hp < 100000 && b.hp < 100000);
});

test("traps: poison cloud damages the whole 3×3 area and nothing outside it", () => {
  const scene = makeScene();
  scene.spawnBoardPiece({ row: 3, col: 2, type: "poison", level: 1 }, false);
  const inside = [[2, 1], [2, 3], [4, 1], [4, 3], [3, 2]].map(([r, c]) => mkTrapHero(cx(c), cy(r)));
  const outside = [[1, 2], [5, 2], [3, 0], [3, 4]].map(([r, c]) => mkTrapHero(cx(c), cy(r)));
  scene.heroes.push(...inside, ...outside);
  scene.processTraps(1000, 16);
  for (const h of inside) { assert.ok(h.hp < 100000, "внутри 3×3 — урон"); assert.ok(h.poisonDPS > 0); }
  for (const h of outside) assert.equal(h.hp, 100000, "за пределами 3×3 — не задевает");
});

test("traps: tesla lightning fires only when stepped on and chains through exactly 3 heroes", () => {
  const scene = makeScene();
  scene.spawnBoardPiece({ row: 3, col: 2, type: "lightning", level: 5 }, false); // уровень не увеличивает цепь
  const near = mkTrapHero(cx(2), cy(2)); // рядом, но не на клетке
  scene.heroes.push(near);
  scene.processTraps(1000, 5000);
  assert.equal(near.hp, 100000, "никто не наступил — молния молчит");

  const stepper = mkTrapHero(cx(2), cy(3));
  const others = [mkTrapHero(cx(1), cy(3)), mkTrapHero(cx(3), cy(3)), mkTrapHero(cx(1), cy(2))];
  scene.heroes.push(stepper, ...others);
  scene.processTraps(2000, 16);
  const hit = [near, stepper, ...others].filter((h) => h.hp < 100000);
  assert.equal(hit.length, 3, "цепь ровно по 3 героям");
  assert.ok(stepper.hp < 100000, "первым бьёт наступившего");
});

test("traps: teleport sends back only the hero who stepped on it, once", () => {
  const scene = makeScene();
  scene.spawnBoardPiece({ row: 6, col: 2, type: "teleport", level: 1 }, false);
  const near = mkTrapHero(cx(2), cy(5));
  scene.heroes.push(near);
  scene.processTraps(1000, 16);
  assert.equal(near.container.y, cy(5), "не на клетке — не телепортирует");

  const stepper = mkTrapHero(cx(2), cy(6));
  scene.heroes.push(stepper);
  scene.processTraps(1016, 16);
  assert.ok(stepper.container.y < cy(6), "наступившего вернуло назад");
  const back = stepper.container.y;
  stepper.container.y = cy(6); // дошёл до телепорта снова
  scene.processTraps(99999, 99999);
  assert.equal(stepper.container.y, cy(6), "один и тот же герой телепортируется один раз");
  assert.ok(back >= 155);
});

test("traps: black hole pulls heroes towards itself, damages only those caught in it", () => {
  const scene = makeScene();
  scene.spawnBoardPiece({ row: 4, col: 2, type: "blackhole", level: 1 }, false);
  const pulled = mkTrapHero(cx(1), cy(3));
  const far = mkTrapHero(cx(2), cy(0)); // вне радиуса притяжения
  scene.heroes.push(pulled, far);
  scene.processTraps(1000, 16);
  assert.equal(pulled.hp, 100000, "на расстоянии дыра не ранит");
  assert.ok(pulled.container.x > cx(1), "героя тянет к дыре");
  assert.equal(far.container.x, cx(2));
  for (let i = 0; i < 100; i++) scene.processTraps(1016 + i * 16, 16);
  assert.equal(pulled.container.x, cx(2), "стянут в колонку дыры");
  pulled.container.y = cy(4); // дошёл до клетки дыры
  scene.processTraps(9000, 5000);
  assert.ok(pulled.hp < 100000, "попавший в дыру получает урон");
  assert.equal(far.hp, 100000);
});
