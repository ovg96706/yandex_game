/**
 * Таблица юнитов из дизайн-документа: волны разблокировки и роли/поведение.
 * Ловушки: Шипы 1, Огонь 5, Лёд 10, Яд 20, Молния 35, Телепорт 50, Чёрная дыра 70.
 * Монстры: Слайм 1, Скелет 8, Гоблин 15, Элементаль 25, Рыцарь 40, Некромант 55, Дракон 80.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { TOOL_DEFS } from "../dungeon_keeper_mvp/js/config.js";

const unlockOf = (id) => TOOL_DEFS[id].unlockWave ?? 1;

test("traps unlock exactly on the design-doc waves", () => {
  assert.equal(unlockOf("spikes"), 1);
  assert.equal(unlockOf("fire_tile"), 5);
  assert.equal(unlockOf("ice_wall"), 10);
  assert.equal(unlockOf("poison"), 20);
  assert.equal(unlockOf("lightning"), 35);
  assert.equal(unlockOf("teleport"), 50);
  assert.equal(unlockOf("blackhole"), 70);
});

test("monsters unlock exactly on the design-doc waves", () => {
  assert.equal(unlockOf("slime"), 1);
  assert.equal(unlockOf("skeleton"), 8);
  assert.equal(unlockOf("goblin"), 15);
  assert.equal(unlockOf("elemental"), 25);
  assert.equal(unlockOf("dark_knight"), 40);
  assert.equal(unlockOf("necromancer"), 55);
  assert.equal(unlockOf("dragon"), 80);
});

test("trap behaviors match the spec table", () => {
  // Шипы: урон только наступившим, периодически.
  assert.equal(TOOL_DEFS.spikes.stepOnly, true);
  // Огненная плитка: поджигает (DoT).
  assert.ok(TOOL_DEFS.fire_tile.burnDPS > 0 && TOOL_DEFS.fire_tile.burnDuration > 0);
  // Ледяная стена: замедляет на 3 секунды (без полной остановки).
  assert.equal(TOOL_DEFS.ice_wall.slowDuration, 3000);
  assert.ok(TOOL_DEFS.ice_wall.slowFactor > 0 && TOOL_DEFS.ice_wall.slowFactor < 1);
  assert.equal(TOOL_DEFS.ice_wall.blockDuration, undefined);
  // Ядовитое облако: урон по области 3×3 клетки (aoeCells=1 вокруг своей).
  assert.equal(TOOL_DEFS.poison.aoeCells, 1);
  // Молния: цепочка по 3 героям.
  assert.equal(TOOL_DEFS.lightning.chainCount, 3);
  // Телепорт: возвращает героя назад, не нанося урона.
  assert.ok(TOOL_DEFS.teleport.teleportRows > 0);
  assert.equal(TOOL_DEFS.teleport.damage, 0);
  // Чёрная дыра: притягивает.
  assert.ok(TOOL_DEFS.blackhole.pullRadius > 0);
});

test("monster roles match the spec table", () => {
  const monsters = Object.values(TOOL_DEFS).filter((d) => d.kind === "monster");
  const slime = TOOL_DEFS.slime, skeleton = TOOL_DEFS.skeleton;
  const goblin = TOOL_DEFS.goblin, elemental = TOOL_DEFS.elemental;
  const knight = TOOL_DEFS.dark_knight, necro = TOOL_DEFS.necromancer;
  const dragon = TOOL_DEFS.dragon;

  // Слайм: слабый (минимальный урон), дешёвый (минимальная цена), много HP.
  assert.equal(slime.damage, Math.min(...monsters.map((m) => m.damage)));
  assert.equal(slime.cost, Math.min(...monsters.map((m) => m.cost)));
  assert.ok(slime.monsterHP > skeleton.monsterHP, "slime is tankier than the mid-tier skeleton");

  // Скелет-воин: средний урон и HP.
  assert.ok(skeleton.damage > slime.damage && skeleton.damage < knight.damage);
  assert.ok(skeleton.monsterHP > goblin.monsterHP && skeleton.monsterHP < knight.monsterHP);

  // Гоблин-лучник: дальний бой.
  assert.ok(goblin.range >= 3, "goblin outranges melee units");
  assert.ok(goblin.range > skeleton.range && goblin.range > knight.range);

  // Огненный элементаль: атакует по области.
  assert.ok(elemental.aoeRange >= 2);

  // Тёмный рыцарь: танк (максимум HP среди не-драконов) + высокий урон/контратака.
  assert.equal(knight.monsterHP, Math.max(...monsters.filter((m) => m.id !== "dragon").map((m) => m.monsterHP)));
  assert.ok(knight.counterDamage > 0);

  // Некромант: воскрешает павших.
  assert.ok(necro.reviveInterval > 0 && necro.reviveHpFactor > 0 && necro.reviveHpFactor < 1);

  // Древний дракон: ультра-мощный и дорогой — максимум по всем статьям, 2×2.
  assert.equal(dragon.cost, Math.max(...monsters.map((m) => m.cost)));
  assert.equal(dragon.damage, Math.max(...monsters.map((m) => m.damage)));
  assert.equal(dragon.monsterHP, Math.max(...monsters.map((m) => m.monsterHP)));
  assert.equal(dragon.size, 2);
});

test("traps never shoot at range: each has a design-doc trigger", async () => {
  const { getToolRange, getTrapTrigger } = await import("../dungeon_keeper_mvp/js/config.js");
  const expected = { spikes: "step", fire_tile: "step", ice_wall: "step", poison: "area", lightning: "chain", teleport: "teleport", blackhole: "pull" };
  for (const [id, trig] of Object.entries(expected)) {
    assert.equal(getTrapTrigger(TOOL_DEFS[id]), trig, id);
    assert.equal(getToolRange(TOOL_DEFS[id], { trapRangeBonus: 3 }), 0, `${id} has no shooting range`);
  }
});
