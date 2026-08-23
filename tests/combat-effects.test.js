/**
 * Механики боя, доведённые до дизайн-документа:
 * лучник, поджог огненной плитки (DoT), блокировка ледяной стеной, воскрешение некроманта.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  HERO_TYPES, TOOL_DEFS, getBurnEffect, getBlockDuration, getReviveHP,
  getMonsterMaxHP, pickHeroType, getHeroAttackDamage,
} from "../dungeon_keeper_mvp/js/config.js";

test("archer exists, fights at range and can be rolled as a regular hero", () => {
  const archer = HERO_TYPES.archer;
  assert.ok(archer, "archer hero type is missing");
  assert.equal(archer.isBoss, false);
  assert.ok(archer.attackMult > 0, "archer must be able to attack monsters");
  // Дистанционный бой: дальность больше, чем у ближников.
  assert.ok(archer.attackRange > HERO_TYPES.warrior.attackRange);
  assert.ok(archer.attackRange > HERO_TYPES.knight.attackRange);
  assert.ok(getHeroAttackDamage(archer, 10) > 0);

  // На волнах после разблокировки лучник реально попадает в выборку.
  let seen = false;
  for (let i = 0; i < 500 && !seen; i++) seen = pickHeroType(20).id === "archer";
  assert.ok(seen, "archer never appears in the hero pool");
});

test("fire tile applies a burn DoT scaled by level and trap damage bonus", () => {
  const fire = TOOL_DEFS.fire_tile;
  const base = getBurnEffect(fire, 1, { trapDamageBonus: 1 });
  assert.ok(base && base.dps > 0 && base.duration > 0);
  const lvl3 = getBurnEffect(fire, 3, { trapDamageBonus: 1 });
  assert.ok(lvl3.dps > base.dps, "burn must scale with merge level");
  const buffed = getBurnEffect(fire, 1, { trapDamageBonus: 2 });
  assert.ok(buffed.dps > base.dps, "burn must respect trapDamageBonus");
  // Ловушки без поджога не должны накладывать DoT.
  assert.equal(getBurnEffect(TOOL_DEFS.spikes, 5, { trapDamageBonus: 3 }), null);
});

test("ice wall both slows for 3s and physically blocks the hero", () => {
  const ice = TOOL_DEFS.ice_wall;
  assert.equal(ice.slowDuration, 3000, "design doc: ice slows for 3 seconds");
  const block1 = getBlockDuration(ice, 1);
  assert.ok(block1 > 0, "ice wall must stop the hero, not only slow him");
  assert.ok(getBlockDuration(ice, 4) > block1, "block grows with merge level");
  assert.ok(getBlockDuration(ice, 5) <= 2500, "block is capped");
  assert.equal(getBlockDuration(TOOL_DEFS.spikes, 5), 0);
});

test("necromancer revives fallen monsters with partial HP", () => {
  const necro = TOOL_DEFS.necromancer;
  assert.ok(necro.reviveInterval > 0);
  const full = getMonsterMaxHP(TOOL_DEFS.skeleton, 2);
  const revived = getReviveHP(TOOL_DEFS.skeleton, 2);
  assert.ok(revived > 0 && revived < full, "revived monster returns weakened");
  assert.equal(revived, Math.floor(full * necro.reviveHpFactor));
});
